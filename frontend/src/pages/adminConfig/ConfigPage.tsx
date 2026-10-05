import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Link, useBlocker, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { SkeletonLine } from "../../components/skeleton/Skeleton.tsx";
import { applyBrand, applyPanelSkin, currentInstallation, refreshInstallation, useWords } from "../../lib/installation.ts";
import { applyElementColors } from "../../lib/elementColors.ts";
import { deleteImage, getOfficeConfig, messageOf, saveOfficeConfig, type OfficeConfig } from "./configService.ts";
import { Modal } from "../../components/modal/Modal.tsx";
import { OfficeSection } from "./sections/OfficeSection.tsx";
import { AppearanceSection } from "./sections/AppearanceSection.tsx";
import { HomeSection } from "./sections/HomeSection.tsx";
import { BookingRulesSection, TeamRulesSection } from "./sections/PoliciesSection.tsx";
import { SpecialitiesSection } from "./sections/SpecialitiesSection.tsx";
import { AssistantSection } from "./sections/AssistantSection.tsx";
import { VocabularySection } from "./sections/VocabularySection.tsx";
import { PhotosSection } from "./sections/PhotosSection.tsx";
import { FaqSection } from "./sections/FaqSection.tsx";
import { ContactReasonsSection } from "./sections/ContactReasonsSection.tsx";
import type { SectionProps } from "./fields.tsx";
import "../adminCRUDS/adminPanel.css";
import "./config.css";

/**
 * La configuración del consultorio, del lado de la administración.
 *
 * Es lo que el consultorio decide por su cuenta: cómo se llama y dónde queda, cómo se ven
 * los paneles y la portada, las reglas de los turnos y qué sabe el asistente. Lo técnico
 * —claves, límites de seguridad, el recorrido 3D— no está acá: lo configura quien instala
 * el sistema.
 *
 * Va en pestañas, pero es una sola configuración: se edita lo que haga falta en cualquiera
 * y se guarda una vez, con la barra de abajo. Se manda solo lo que cambió, y el servidor
 * rechaza el pedido entero si algo no entra en su rango, así no queda media configuración
 * guardada.
 */

const TABS = [
  { id: "consultorio", label: "Consultorio", Section: OfficeSection },
  { id: "especialidades", label: "Especialidades", Section: SpecialitiesSection },
  { id: "apariencia", label: "Apariencia", Section: AppearanceSection },
  { id: "portada", label: "Portada", Section: HomeSection },
  { id: "fotos", label: "Fotos", Section: PhotosSection },
  { id: "preguntas", label: "Preguntas", Section: FaqSection },
  { id: "contacto", label: "Contacto", Section: ContactReasonsSection },
  { id: "turnos", label: "Turnos", Section: BookingRulesSection },
  { id: "permisos", label: "Permisos", Section: TeamRulesSection },
  { id: "palabras", label: "Palabras", Section: VocabularySection },
  { id: "asistente", label: "Asistente", Section: AssistantSection },
] as const satisfies ReadonlyArray<{ id: string; label: string; Section: (props: SectionProps) => ReactElement }>;

type TabId = (typeof TABS)[number]["id"];

/** Lo que cambió entre lo guardado y lo editado, para mandar solo eso. */
function changesOf(saved: OfficeConfig, draft: OfficeConfig): Partial<OfficeConfig> {
  const changes: Record<string, unknown> = {};
  for (const key of Object.keys(draft) as (keyof OfficeConfig)[]) {
    // Lo que no se guarda: el catálogo de reglas, los bloqueos y la fecha.
    if (key === "rules" || (key as string) === "locked" || (key as string) === "updatedAt") continue;
    // De las reglas va solo la que cambió: mandarlas todas tocaría también las bloqueadas,
    // y el servidor rechazaría el pedido entero.
    if (key === "policies") {
      const diff: Record<string, unknown> = {};
      for (const [rule, value] of Object.entries(draft.policies ?? {}))
        if (JSON.stringify(value) !== JSON.stringify((saved.policies as unknown as Record<string, unknown>)?.[rule])) diff[rule] = value;
      if (Object.keys(diff).length) changes.policies = diff;
      continue;
    }
    if (JSON.stringify(draft[key]) !== JSON.stringify(saved[key])) changes[key] = draft[key];
  }
  return changes as Partial<OfficeConfig>;
}

export function ConfigPage() {
  const w = useWords();
  const [saved, setSaved] = useState<OfficeConfig | null>(null);
  const [draft, setDraft] = useState<OfficeConfig | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  // La pestaña va en la dirección, así un link puede llevar directo a "Portada" y volver
  // atrás no saca de la pantalla.
  const [params, setParams] = useSearchParams();
  const tab: TabId = TABS.some((item) => item.id === params.get("seccion"))
    ? (params.get("seccion") as TabId)
    : "consultorio";

  useEffect(() => {
    getOfficeConfig()
      .then((config) => {
        setSaved(config);
        setDraft(config);
      })
      .catch(() => setFailed(true));
  }, []);

  // La vista previa de la apariencia es la pantalla misma: mientras se elige un estilo o un
  // color, se pintan sobre <html> sin guardar. Al irse de acá vuelve lo guardado.
  const panelSkin = draft?.panelSkin;
  const brandHue = draft?.brandHue ?? null;
  const brandSaturation = draft?.brandSaturation ?? null;
  const elementColors = JSON.stringify(draft?.elementColors ?? {});

  useEffect(() => {
    if (!panelSkin) return;
    applyPanelSkin(panelSkin);
    applyBrand(brandHue !== null && brandSaturation !== null ? { hue: brandHue, saturation: brandSaturation } : null);
    applyElementColors(JSON.parse(elementColors));
  }, [panelSkin, brandHue, brandSaturation, elementColors]);

  useEffect(
    () => () => {
      const current = currentInstallation();
      applyPanelSkin(current.panelSkin);
      applyBrand(current.brand);
      applyElementColors(current.elementColors);
    },
    []
  );

  const changes = useMemo(() => (saved && draft ? changesOf(saved, draft) : {}), [saved, draft]);
  const dirty = Object.keys(changes).length > 0;

  // Un número borrado queda como NaN, y mandado así el servidor lo leería como cero: un
  // horizonte de cero semanas guardado sin que nadie lo haya querido. No se deja guardar.
  const emptyNumber = [...Object.values(changes), ...Object.values(changes.policies ?? {})].some(
    (value) => typeof value === "number" && Number.isNaN(value)
  );

  /**
   * Lo subido en este borrador que no está en lo guardado: las fotos de la portada y de la
   * galería y las de las especialidades. Al descartar se borran del servidor; si alguna
   * queda (se cerró la pestaña), el servidor las borra solo a las pocas horas. Ninguna
   * llega a la página sin guardar.
   */
  function unsavedUploads(): string[] {
    if (!saved || !draft) return [];
    const kept = new Set([
      ...[...(saved.photos?.hero ?? []), ...(saved.photos?.gallery ?? [])].map((image) => image.id),
      ...Object.values(saved.specialityStyles ?? {}).map((style) => style.imageId),
    ]);
    const drafted = [
      ...[...(draft.photos?.hero ?? []), ...(draft.photos?.gallery ?? [])].map((image) => image.id),
      ...Object.values(draft.specialityStyles ?? {}).map((style) => style.imageId),
    ];
    return drafted.filter((id): id is string => !!id && !kept.has(id));
  }

  function discard() {
    for (const id of unsavedUploads()) void deleteImage(id).catch(() => undefined);
    setDraft(saved);
  }

  // Irse a otra pantalla con cambios sin guardar pregunta antes. Cambiar de pestaña no:
  // es la misma configuración. Cerrar o recargar la pestaña lo pregunta el navegador.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function set<K extends keyof OfficeConfig>(key: K, value: OfficeConfig[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  async function save() {
    if (!dirty) return;
    setSaving(true);
    try {
      const result = await saveOfficeConfig(changes);
      setSaved(result);
      setDraft(result);
      // La portada y el resto de la aplicación leen la configuración pública: sin volver a
      // pedirla, seguirían con lo de antes hasta recargar.
      void refreshInstallation();
      toast.success("Configuración guardada");
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setSaving(false);
    }
  }

  const Current = TABS.find((item) => item.id === tab)!.Section;

  return (
    <div className="adm-page cfg-page">
      <header className="adm-header">
        <div className="adm-header-titles">
          <h1 className="adm-title">Configuración</h1>
          <p className="adm-subtitle">{`Lo que ${w.el("lugar")} decide por su cuenta`}</p>
        </div>
        <Link className="adm-back" to="/AdminHome">
          Volver al panel
        </Link>
      </header>

      <nav className="cfg-tabs" aria-label="Secciones de la configuración">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`cfg-tab ${item.id === tab ? "is-active" : ""}`}
            aria-current={item.id === tab ? "page" : undefined}
            onClick={() => setParams({ seccion: item.id }, { replace: true })}
          >
            {item.id === "consultorio" ? w.Lugar : item.id === "turnos" ? w.Turnos : item.id === "especialidades" ? w.Especialidades : item.label}
          </button>
        ))}
      </nav>

      {failed ? (
        <div className="adm-panel">
          <div className="adm-empty">No se pudo cargar la configuración</div>
        </div>
      ) : !draft ? (
        <div className="adm-panel cfg-loading">
          <SkeletonLine />
          <SkeletonLine />
          <SkeletonLine />
        </div>
      ) : (
        <>
          <Current draft={draft} set={set} />

          <div className={`cfg-savebar ${dirty ? "is-dirty" : ""}`} role="region" aria-label="Guardar cambios">
            <span>{emptyNumber ? "Falta completar un número" : dirty ? "Hay cambios sin guardar" : "Todo guardado"}</span>
            <div className="adm-btn-row">
              <button type="button" className="adm-btn" onClick={discard} disabled={!dirty || saving}>
                Descartar
              </button>
              <button
                type="button"
                className="adm-btn adm-btn-primary"
                onClick={save}
                disabled={!dirty || saving || emptyNumber}
              >
                {saving ? "Guardando" : "Guardar"}
              </button>
            </div>
          </div>
        </>
      )}

      <Modal
        open={blocker.state === "blocked"}
        onClose={() => blocker.reset?.()}
        size="sm"
        title="Hay cambios sin guardar"
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-ghost" onClick={() => blocker.reset?.()}>
              Seguir editando
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-danger"
              onClick={() => {
                discard();
                blocker.proceed?.();
              }}
            >
              Salir sin guardar
            </button>
          </>
        }
      >
        <p className="adm-confirm-lead">Lo que no se guardó se pierde, también las fotos subidas.</p>
      </Modal>
    </div>
  );
}
