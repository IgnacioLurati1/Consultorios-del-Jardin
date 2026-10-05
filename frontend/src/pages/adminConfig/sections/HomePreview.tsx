import { useCallback, useEffect, useRef, useState } from "react";
import { PREVIEW_MESSAGE, currentInstallation, type Installation } from "../../../lib/installation.ts";
import type { OfficeConfig } from "../configService.ts";

/**
 * La portada de verdad, con lo que se está editando.
 *
 * Es la misma aplicación cargada en un iframe con ?vista-previa en la dirección. En ese
 * modo la portada no se queda con lo que contestó el servidor: espera lo que le manda esta
 * pantalla por mensaje (ver lib/installation). Cada cambio del borrador se le vuelve a
 * mandar, así que se ve al instante y sin guardar nada.
 *
 * El iframe se dibuja al ancho de una pantalla de verdad —una computadora o un celular— y
 * se achica entero para que entre en el panel. Achicar la página y no el iframe es lo que
 * hace que se vea como se va a ver: con el ancho angosto, la portada pasaría al diseño de
 * celular aunque se esté mirando la de computadora.
 */

const DEVICES = {
  computadora: { width: 1280, height: 820 },
  celular: { width: 390, height: 780 },
} as const;

type Device = keyof typeof DEVICES;
type Viewer = "visitante" | "paciente";

/** El borrador de la configuración, en la forma en que lo lee la portada. */
function asInstallation(draft: OfficeConfig): Installation {
  const saved = currentInstallation();
  return {
    ...saved,
    name: draft.name,
    tagline: draft.tagline,
    address: draft.address,
    city: draft.city,
    publicHours: draft.publicHours,
    instagram: draft.instagram,
    email: draft.email,
    mapEmbedUrl: draft.mapEmbedUrl,
    directionsUrl: draft.directionsUrl,
    services: draft.services.map((item) => item.trim()).filter(Boolean),
    specialityStyles: draft.specialityStyles ?? saved.specialityStyles,
    brand:
      draft.brandHue !== null && draft.brandSaturation !== null
        ? { hue: draft.brandHue, saturation: draft.brandSaturation }
        : null,
    heroStyle: draft.heroStyle,
    homeTemplate: draft.homeTemplate,
    panelSkin: draft.panelSkin,
    vocabulary: draft.vocabulary,
    homeBlocks: { guest: draft.homeBlocksGuest, member: draft.homeBlocksMember },
    homeVariants: draft.homeVariants ?? {},
    // Las fotos del borrador, también las subidas sin guardar: la vista previa es lo que se va a publicar.
    images: draft.photos
      ? {
          hero: draft.photos.hero.map(({ id, alt, width, height, preview }) => ({ id, alt, width, height, preview })),
          gallery: draft.photos.gallery.map(({ id, alt, width, height, preview }) => ({ id, alt, width, height, preview })),
        }
      : saved.images,
    elementColors: draft.elementColors ?? {},
  };
}

export function HomePreview({ draft }: { draft: OfficeConfig }) {
  const [device, setDevice] = useState<Device>("computadora");
  const [viewer, setViewer] = useState<Viewer>("visitante");
  const [scale, setScale] = useState(0.5);
  const [boxWidth, setBoxWidth] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);

  const size = DEVICES[device];
  const installation = JSON.stringify(asInstallation(draft));

  // Cuánto se achica, según el ancho que haya en el panel.
  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setBoxWidth(entry.contentRect.width);
      setScale(Math.min(1, entry.contentRect.width / size.width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [size.width]);

  // Cada cambio del borrador, a la portada. Lo mismo al terminar de cargar (onLoad, abajo),
  // porque lo que se mandó antes de que cargara se perdió.
  const send = useCallback(() => {
    frame.current?.contentWindow?.postMessage(
      { type: PREVIEW_MESSAGE, installation: JSON.parse(installation) },
      window.location.origin
    );
  }, [installation]);

  useEffect(send, [send]);

  const src = `${import.meta.env.BASE_URL}?vista-previa=${viewer}`;

  return (
    <section className="adm-panel cfg-section">
      <h2 className="adm-panel-head">
        Vista previa
        <span className="cfg-preview-toggles">
          <Toggle
            label="Pantalla"
            value={device}
            options={[
              ["computadora", "Computadora"],
              ["celular", "Celular"],
            ]}
            onChange={(value) => setDevice(value as Device)}
          />
          <Toggle
            label="Quién mira"
            value={viewer}
            options={[
              ["visitante", "Visitante"],
              ["paciente", "Con sesión"],
            ]}
            onChange={(value) => setViewer(value as Viewer)}
          />
        </span>
      </h2>

      <div className="cfg-preview-body">
        <div ref={box} className="cfg-preview-box" style={{ height: size.height * scale }}>
          <iframe
            ref={frame}
            key={src}
            className="cfg-preview-frame"
            title="Vista previa de la portada"
            src={src}
            onLoad={send}
            style={{
              width: size.width,
              height: size.height,
              // El celular, más angosto que el panel, va al medio.
              left: Math.max(0, (boxWidth - size.width * scale) / 2),
              transform: `scale(${scale})`,
            }}
          />
        </div>
        <p className="cfg-lead">Lo que se ve acá todavía no está guardado.</p>
      </div>
    </section>
  );
}

function Toggle({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <span className="cfg-toggle" role="radiogroup" aria-label={label}>
      {options.map(([id, text]) => (
        <button key={id} type="button" role="radio" aria-checked={value === id} className={value === id ? "is-on" : undefined} onClick={() => onChange(id)}>
          {text}
        </button>
      ))}
    </span>
  );
}
