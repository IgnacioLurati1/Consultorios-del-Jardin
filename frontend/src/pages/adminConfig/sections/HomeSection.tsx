import { FaArrowDown, FaArrowUp, FaCircleCheck } from "react-icons/fa6";
import {
  HOME_BLOCKS,
  HOME_TEMPLATES,
  HOME_VARIANTS,
  homeVariantsOf,
  type HeroStyle,
  type HomeBlock,
  type HomeTemplate,
  type HomeVariantSection,
} from "../../../lib/installation.ts";
import { Section, type SectionProps } from "../fields.tsx";
import { HomePreview } from "./HomePreview.tsx";
import { VariantSketch } from "./VariantSketch.tsx";

/** Cómo se llama cada bloque de la portada en esta pantalla. */
const BLOCK_NAMES: Record<HomeBlock, string> = {
  garland: "Guirnalda de fechas",
  hero: "Portada",
  services: "Especialidades",
  gallery: "Galería",
  yourSpace: "Accesos",
  location: "Ubicación",
  footer: "Pie",
};

/**
 * La portada: el diseño general, el diseño de cada sección y qué bloques lleva, con la
 * portada de verdad abajo como vista previa.
 *
 * El diseño general es la portada entera: la letra, las esquinas, los colores de las
 * franjas, y un diseño propuesto para cada sección y un orden de bloques. Elegirlo trae
 * todo eso junto. Después cada sección se puede cambiar por otro de sus tres diseños sin
 * perder el general.
 */
export function HomeSection({ draft, set }: SectionProps) {
  function choose(id: HomeTemplate) {
    const template = HOME_TEMPLATES.find((item) => item.id === id)!;
    set("homeTemplate", id);
    set("heroStyle", template.heroStyle);
    set("homeBlocksGuest", [...template.guest]);
    set("homeBlocksMember", [...template.member]);
    // Las secciones vuelven a las que propone el diseño elegido.
    set("homeVariants", {});
  }

  return (
    <>
      <Section title="Portada">
        <fieldset className="cfg-skins cfg-wide">
          <legend>Diseño</legend>
          <div className="cfg-skin-grid">
            {HOME_TEMPLATES.map((template) => {
              const selected = draft.homeTemplate === template.id;
              return (
                <label key={template.id} className={`cfg-skin ${selected ? "is-selected" : ""}`}>
                  <input
                    type="radio"
                    name="home-template"
                    value={template.id}
                    checked={selected}
                    onChange={() => choose(template.id)}
                  />
                  <TemplateSketch id={template.id} />
                  <span className="cfg-skin-name">
                    {selected ? <FaCircleCheck aria-hidden="true" /> : null}
                    {template.label}
                  </span>
                  <small>{template.description}</small>
                </label>
              );
            })}
          </div>
        </fieldset>

        <SectionDesigns draft={draft} set={set} />

        <BlockOrder title="Para visitantes" value={draft.homeBlocksGuest} onChange={(v) => set("homeBlocksGuest", v)} />
        <BlockOrder title="Con sesión iniciada" value={draft.homeBlocksMember} onChange={(v) => set("homeBlocksMember", v)} />
      </Section>

      <HomePreview draft={draft} />
    </>
  );
}

/** Los tres diseños de la portada de arriba, que se guardan aparte como `heroStyle`. */
const HERO_OPTIONS: ReadonlyArray<{ id: HeroStyle; label: string; description: string }> = [
  { id: "collage", label: "Collage", description: "Las fotos en tiras, con el nombre encima" },
  { id: "photo", label: "Una foto", description: "Una foto grande de lado a lado" },
  { id: "text", label: "Solo el nombre", description: "Sin fotos, el nombre en grande" },
];

/** Las secciones con diseño propio, en el orden en que suelen aparecer. */
const SECTIONS: ReadonlyArray<{ id: HomeVariantSection; label: string }> = [
  { id: "services", label: "Especialidades" },
  { id: "gallery", label: "Galería" },
  { id: "yourSpace", label: "Accesos" },
  { id: "location", label: "Ubicación" },
  { id: "footer", label: "Pie" },
];

/**
 * El diseño de cada sección, con un dibujo de cada uno.
 *
 * Lo que se guarda es solo lo que se apartó del diseño general: elegir para una sección
 * el mismo que propone el general la vuelve a dejar siguiéndolo, así un cambio de
 * diseño general más adelante también la cambia.
 */
function SectionDesigns({ draft, set }: SectionProps) {
  const template = HOME_TEMPLATES.find((item) => item.id === draft.homeTemplate) ?? HOME_TEMPLATES[0];
  const chosen = draft.homeVariants ?? {};
  const current = homeVariantsOf({ homeTemplate: draft.homeTemplate, homeVariants: chosen });
  const changed = Object.keys(chosen).length > 0 || draft.heroStyle !== template.heroStyle;

  function pick(section: HomeVariantSection, id: string) {
    const next: Record<string, string> = { ...chosen, [section]: id };
    if (template.variants[section] === id) delete next[section];
    set("homeVariants", next as typeof chosen);
  }

  return (
    <fieldset className="cfg-variants cfg-wide">
      <legend>Diseño de cada sección</legend>

      <VariantRow label="Arriba" name="hero">
        {HERO_OPTIONS.map((option) => (
          <VariantOption
            key={option.id}
            name="variant-hero"
            sketch={`hero.${option.id}`}
            label={option.label}
            description={option.description}
            selected={draft.heroStyle === option.id}
            onSelect={() => set("heroStyle", option.id)}
          />
        ))}
      </VariantRow>

      {SECTIONS.map((section) => (
        <VariantRow key={section.id} label={section.label} name={section.id}>
          {HOME_VARIANTS[section.id].map((option) => (
            <VariantOption
              key={option.id}
              name={`variant-${section.id}`}
              sketch={`${section.id}.${option.id}`}
              label={option.label}
              description={option.description}
              selected={current[section.id] === option.id}
              onSelect={() => pick(section.id, option.id)}
            />
          ))}
        </VariantRow>
      ))}

      {changed ? (
        <button
          type="button"
          className="adm-btn adm-btn-ghost cfg-variants-reset"
          onClick={() => {
            set("homeVariants", {});
            set("heroStyle", template.heroStyle);
          }}
        >
          {`Volver a las del diseño ${template.label}`}
        </button>
      ) : null}
    </fieldset>
  );
}

function VariantRow({ label, name, children }: { label: string; name: string; children: React.ReactNode }) {
  return (
    <div className="cfg-variant-row" role="radiogroup" aria-labelledby={`variant-label-${name}`}>
      <span className="cfg-variant-label" id={`variant-label-${name}`}>
        {label}
      </span>
      <div className="cfg-variant-options">{children}</div>
    </div>
  );
}

function VariantOption({
  name,
  sketch,
  label,
  description,
  selected,
  onSelect,
}: {
  name: string;
  sketch: string;
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label className={`cfg-variant ${selected ? "is-selected" : ""}`} title={description}>
      <input type="radio" name={name} checked={selected} onChange={onSelect} />
      <VariantSketch id={sketch} />
      <span className="cfg-variant-name">{label}</span>
    </label>
  );
}

/**
 * Un dibujo esquemático de cada diseño, para reconocerlo de un vistazo. La portada de
 * verdad está abajo, en la vista previa.
 */
function TemplateSketch({ id }: { id: HomeTemplate }) {
  return (
    <div className={`cfg-sketch cfg-sketch--${id}`} aria-hidden="true">
      <div className="cfg-sketch-hero">
        {id === "jardin" ? (
          <>
            <i />
            <i />
            <i />
            <i />
          </>
        ) : null}
        <b />
      </div>
      <div className="cfg-sketch-band" />
      <div className="cfg-sketch-cards">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

/**
 * Qué bloques lleva la portada y en qué orden.
 *
 * Están todos en la lista: los prendidos arriba, en su orden, y los apagados abajo. Prender
 * uno lo suma al final.
 */
function BlockOrder({ title, value, onChange }: { title: string; value: HomeBlock[]; onChange: (v: HomeBlock[]) => void }) {
  const off = HOME_BLOCKS.filter((block) => !value.includes(block));

  function move(index: number, by: number) {
    const next = [...value];
    const [block] = next.splice(index, 1);
    next.splice(index + by, 0, block);
    onChange(next);
  }

  return (
    <fieldset className="cfg-blocks cfg-wide">
      <legend>{title}</legend>
      <ul>
        {value.map((block, index) => (
          <li key={block}>
            <input
              type="checkbox"
              className="adm-switch"
              checked
              aria-label={`Sacar ${BLOCK_NAMES[block]}`}
              onChange={() => onChange(value.filter((item) => item !== block))}
            />
            <span>{BLOCK_NAMES[block]}</span>
            <button
              type="button"
              className="cfg-move"
              onClick={() => move(index, -1)}
              disabled={index === 0}
              aria-label={`Subir ${BLOCK_NAMES[block]}`}
            >
              <FaArrowUp aria-hidden="true" />
            </button>
            <button
              type="button"
              className="cfg-move"
              onClick={() => move(index, 1)}
              disabled={index === value.length - 1}
              aria-label={`Bajar ${BLOCK_NAMES[block]}`}
            >
              <FaArrowDown aria-hidden="true" />
            </button>
          </li>
        ))}
        {off.map((block) => (
          <li key={block} className="is-off">
            <input
              type="checkbox"
              className="adm-switch"
              checked={false}
              aria-label={`Mostrar ${BLOCK_NAMES[block]}`}
              onChange={() => onChange([...value, block])}
            />
            <span>{BLOCK_NAMES[block]}</span>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
