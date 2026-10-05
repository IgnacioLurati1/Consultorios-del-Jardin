import { useEffect } from "react";
import { FaCircleCheck } from "react-icons/fa6";
import { PANEL_SKINS, type PanelSkin } from "../../../lib/installation.ts";
import { words, type Words } from "../../../lib/vocabulary.ts";
import { Section, SwitchRow, type SectionProps } from "../fields.tsx";
import { ELEMENT_COLOR_INFO, MAX_LIGHT, readableBackground, type ElementColorKey } from "../../../lib/elementColors.ts";

/**
 * Cómo se ven los paneles: el estilo y el color.
 *
 * Son dos cosas que se combinan. El estilo es la forma —letra, esquinas, sombras, cuánto
 * color llevan los grises— y el color es la marca o, sin marca, el de la estación. Mientras
 * se elige, esta misma pantalla se redibuja con lo elegido (ver ConfigPage), así que la
 * vista previa más fiel es la que se tiene enfrente. Cada opción trae además una muestra
 * chica con su propio estilo, para comparar sin tener que tocarlas una por una.
 */
export function AppearanceSection({ draft, set }: SectionProps) {
  const fixed = draft.brandHue !== null && draft.brandSaturation !== null;
  const hue = draft.brandHue ?? 116;
  const saturation = draft.brandSaturation ?? 32;
  const w = words(draft.vocabulary);

  // Las muestras usan la letra de cada estilo, así que hay que tenerlas todas cargadas.
  useEffect(() => {
    for (const skin of PANEL_SKINS) {
      if (!skin.font || document.querySelector(`link[data-skin-font="${skin.id}"]`)) continue;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${skin.font}&display=swap`;
      link.dataset.skinFont = skin.id;
      document.head.appendChild(link);
    }
  }, []);

  return (
    <Section title="Apariencia">
      <fieldset className="cfg-skins cfg-wide">
        <legend>Estilo de los paneles</legend>
        <div className="cfg-skin-grid">
          {PANEL_SKINS.map((skin) => (
            <SkinOption
              key={skin.id}
              id={skin.id}
              label={skin.label}
              description={skin.description}
              selected={draft.panelSkin === skin.id}
              w={w}
              onSelect={() => set("panelSkin", skin.id)}
            />
          ))}
        </div>
      </fieldset>

      <SwitchRow
        label="Color fijo de la marca"
        hint="Apagado, el color cambia con la estación del año"
        checked={fixed}
        onChange={(on) => {
          set("brandHue", on ? hue : null);
          set("brandSaturation", on ? saturation : null);
        }}
      />

      {fixed ? (
        <div className="cfg-brand cfg-wide">
          <label className="ui-field">
            <span>Tono</span>
            <input type="range" min={0} max={360} value={hue} onChange={(e) => set("brandHue", Number(e.target.value))} />
          </label>
          <label className="ui-field">
            <span>Intensidad</span>
            <input
              type="range"
              min={0}
              max={100}
              value={saturation}
              onChange={(e) => set("brandSaturation", Number(e.target.value))}
            />
          </label>
          <div className="cfg-swatches" aria-hidden="true">
            {[28, 38, 60, 90].map((light) => (
              <i key={light} style={{ background: `hsl(${hue} ${saturation}% ${light}%)` }} />
            ))}
          </div>
        </div>
      ) : null}

      <ElementColorsField draft={draft} set={set} />
    </Section>
  );
}

/** El color con que arranca un elemento al darle uno propio: el verde de siempre. */
const STARTING: Record<ElementColorKey, string> = { header: "#2f5e46", footer: "#14261c", mail: "#3b7658", hero: "#3b7658" };

/**
 * Un color propio para la barra de arriba, el pie y la cabecera de los mails.
 *
 * Apagado, cada uno sigue al color de la marca o al de la estación. Los tres llevan texto
 * claro, así que uno muy claro se oscurece lo justo al pintarlo; la muestra de al lado es
 * el color como va a quedar.
 */
function ElementColorsField({ draft, set }: SectionProps) {
  const colors = draft.elementColors ?? {};

  function change(key: ElementColorKey, value: string | null) {
    const next = { ...colors };
    if (value) next[key] = value;
    else delete next[key];
    set("elementColors", next);
  }

  return (
    <fieldset className="cfg-element-colors cfg-wide">
      <legend>Colores de cada parte</legend>
      <p className="cfg-lead">Sin color propio, cada parte sigue al color de la marca o al de la estación. Un color muy claro se oscurece lo justo para que el texto se lea.</p>
      {ELEMENT_COLOR_INFO.map((item) => {
        const value = colors[item.key];
        return (
          <div key={item.key} className="cfg-element-color">
            <input
              type="checkbox"
              className="adm-switch"
              checked={!!value}
              aria-label={`Color propio para ${item.label.toLowerCase()}`}
              onChange={(event) => change(item.key, event.target.checked ? STARTING[item.key] : null)}
            />
            <span className="cfg-element-text">
              <strong>{item.label}</strong>
              <small>{item.hint}</small>
            </span>
            {value ? (
              <span className="cfg-element-pick">
                <input
                  type="color"
                  value={value}
                  aria-label={`Color de ${item.label.toLowerCase()}`}
                  onChange={(event) => change(item.key, event.target.value)}
                />
                <i className="cfg-element-result" style={{ background: readableBackground(value, MAX_LIGHT[item.key]) }} title="Como queda" />
              </span>
            ) : (
              <small className="cfg-element-follow">Sigue a la marca</small>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}

/**
 * Una opción de estilo, con una muestra dibujada en ese estilo.
 *
 * La muestra lleva `data-panel-skin` propio: la letra, las esquinas y las sombras de ese
 * estilo valen adentro aunque la página tenga otro. Los grises se vuelven a declarar en
 * config.css (`.cfg-skin-sample`), porque una variable que depende de otra se calcula donde
 * se declara, y la de la página ya viene calculada con el estilo de la página.
 */
function SkinOption({
  id,
  label,
  description,
  selected,
  onSelect,
  w,
}: {
  id: PanelSkin;
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
  w: Words;
}) {
  return (
    <label className={`cfg-skin ${selected ? "is-selected" : ""}`}>
      <input type="radio" name="panel-skin" value={id} checked={selected} onChange={onSelect} />

      <div className="cfg-skin-sample" data-panel-skin={id} aria-hidden="true">
        <div className="cfg-skin-bar" />
        <div className="cfg-skin-card">
          <strong>{`${w.Turno} confirmad${w.o("turno")}`}</strong>
          <span>Martes 14 · 10:30</span>
          <div className="cfg-skin-actions">
            <i className="cfg-skin-button">{`Ver ${w.turno}`}</i>
            <i className="cfg-skin-pill">{`Confirmad${w.o("turno")}`}</i>
          </div>
        </div>
      </div>

      <span className="cfg-skin-name">
        {selected ? <FaCircleCheck aria-hidden="true" /> : null}
        {label}
      </span>
      <small>{description}</small>
    </label>
  );
}
