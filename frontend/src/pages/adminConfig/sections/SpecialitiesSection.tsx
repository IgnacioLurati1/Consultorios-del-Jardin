import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { FaArrowDown, FaArrowUp, FaCamera, FaPlus, FaTrashCan, FaXmark } from "react-icons/fa6";
import { imageUrl, useWords } from "../../../lib/installation.ts";
import { SPECIALITY_ICONS, SPECIALITY_TINTS, iconOf, suggestIcon } from "../../../lib/specialityIcons.ts";
import { messageOf, uploadImage } from "../configService.ts";
import { Section, type SectionProps } from "../fields.tsx";

/**
 * Las especialidades del consultorio: cuáles son, en qué orden, y cómo se ven en la portada.
 *
 * Cada una toma el ícono que sugiere su nombre; se puede elegir otro, o subir una foto que
 * lo reemplace. El nombre lo termina de acomodar el servidor al guardar (mayúscula, tildes
 * de las conocidas, sin repetidas), y esa es la lista que usan el pedido de turno, la ficha
 * de cada profesional y el asistente.
 *
 * Las fotos se suben sin publicar, como las de la portada, y cuál va con cada especialidad
 * se guarda con el resto. Al guardar, el servidor publica las que quedaron en uso y borra las
 * que no usa ninguna.
 */
export function SpecialitiesSection({ draft, set }: SectionProps) {
  const w = useWords();
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadFor = useRef<string | null>(null);

  const names = draft.services;
  const styles = draft.specialityStyles ?? {};

  function setNames(next: string[]) {
    set("services", next);
  }

  function setStyle(name: string, change: { icon?: string | null; imageId?: string | null }) {
    const current = styles[name] ?? { icon: null, imageId: null };
    set("specialityStyles", { ...styles, [name]: { ...current, ...change } });
  }

  function rename(index: number, value: string) {
    const old = names[index];
    const next = [...names];
    next[index] = value;
    setNames(next);
    // El estilo va con el nombre: al cambiarlo, se muda.
    if (styles[old] && old !== value) {
      const { [old]: moved, ...rest } = styles;
      set("specialityStyles", { ...rest, [value]: moved });
    }
  }

  function move(index: number, by: number) {
    const next = [...names];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    setNames(next);
  }

  function remove(index: number) {
    const name = names[index];
    setNames(names.filter((_, position) => position !== index));
    set("specialityStyles", Object.fromEntries(Object.entries(styles).filter(([key]) => key !== name)));
  }

  function add() {
    const value = adding.trim().replace(/\s+/g, " ");
    if (!value) return;
    setNames([...names, value]);
    setAdding("");
  }

  function pickPhoto(name: string) {
    uploadFor.current = name;
    fileInput.current?.click();
  }

  async function upload(files: FileList | null) {
    const file = files?.[0];
    const name = uploadFor.current;
    if (fileInput.current) fileInput.current.value = "";
    if (!file || !name) return;

    setBusy(name);
    try {
      const image = await uploadImage("speciality", file, name);
      setStyle(name, { imageId: image.id });
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setBusy(null);
    }
  }

  // Solo del borrador. La foto se borra en el servidor al guardar, si ya no la usa ninguna;
  // borrarla acá dejaba a "Descartar" sin nada que devolver.
  function dropPhoto(name: string) {
    if (!styles[name]?.imageId) return;
    setStyle(name, { imageId: null });
  }

  return (
    <Section title={w.Especialidades}>
      <p className="cfg-lead cfg-wide">
        {`Las que se atienden, en el orden en que se muestran. Son las que se eligen al pedir ${w.turno} y en la ficha de cada ${w.profesional}.`}
      </p>

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        hidden
        onChange={(event) => upload(event.target.files)}
      />

      <ul className="cfg-specs cfg-wide">
        {names.map((name, index) => {
          const style = styles[name];
          const iconKey = style?.icon ?? suggestIcon(name);
          const Icon = iconOf(iconKey);

          return (
            <li key={index} className="cfg-spec">
              <span className="cfg-spec-photo" style={{ "--tint": SPECIALITY_TINTS[index % SPECIALITY_TINTS.length] } as React.CSSProperties}>
                {style?.imageId ? <img src={imageUrl(style.imageId, "small")} alt="" /> : <Icon aria-hidden="true" />}
              </span>

              <label className="ui-field cfg-spec-name">
                <span>Nombre</span>
                <input value={name} maxLength={60} onChange={(event) => rename(index, event.target.value)} />
              </label>

              <label className="ui-field cfg-spec-icon">
                <span>Ícono</span>
                <select value={iconKey} disabled={!!style?.imageId} onChange={(event) => setStyle(name, { icon: event.target.value })}>
                  {SPECIALITY_ICONS.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <span className="cfg-spec-actions">
                {style?.imageId ? (
                  <button type="button" className="adm-btn adm-btn-ghost" disabled={busy === name} onClick={() => dropPhoto(name)}>
                    <FaXmark aria-hidden="true" /> Quitar foto
                  </button>
                ) : (
                  <button type="button" className="adm-btn adm-btn-ghost" disabled={busy === name || !name.trim()} onClick={() => pickPhoto(name)}>
                    <FaCamera aria-hidden="true" /> {busy === name ? "Subiendo" : "Foto"}
                  </button>
                )}
                <button type="button" className="cfg-move" aria-label="Subir" disabled={index === 0} onClick={() => move(index, -1)}>
                  <FaArrowUp />
                </button>
                <button
                  type="button"
                  className="cfg-move"
                  aria-label="Bajar"
                  disabled={index === names.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <FaArrowDown />
                </button>
                <button type="button" className="cfg-move" aria-label={`Sacar ${name}`} onClick={() => remove(index)}>
                  <FaTrashCan />
                </button>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="cfg-spec-add cfg-wide">
        <label className="ui-field">
          <span>{`Nuev${w.o("especialidad")} ${w.especialidad}`}</span>
          <input
            value={adding}
            maxLength={60}
            onChange={(event) => setAdding(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
          />
        </label>
        <button type="button" className="adm-btn adm-btn-primary" onClick={add} disabled={!adding.trim()}>
          <FaPlus aria-hidden="true" /> Agregar
        </button>
      </div>

      <small className="cfg-wide cfg-lead">Al guardar se acomodan las mayúsculas y las tildes de las más comunes.</small>
    </Section>
  );
}
