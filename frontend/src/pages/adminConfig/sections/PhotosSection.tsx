import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { FaArrowLeft, FaArrowRight, FaPlus, FaTrashCan } from "react-icons/fa6";
import { HOME_VARIANTS, homeVariantsOf, imageUrl } from "../../../lib/installation.ts";
import { MAX_UPLOAD_MB, SLOT_LIMITS, messageOf, uploadImage, type AdminImage, type ImageSlot } from "../configService.ts";
import type { SectionProps } from "../fields.tsx";

/**
 * Las fotos de la portada y de la galería.
 *
 * Van en el mismo borrador que el resto de la configuración. Una foto subida queda en el
 * servidor sin publicar; el orden, las descripciones y las que se sacan son del borrador. Todo
 * se publica junto con "Guardar", y con "Descartar" (o al irse sin guardar) nada de esto
 * llega a la página: las subidas que nadie guardó las borra el servidor solo.
 *
 * Mientras no haya ninguna publicada, la portada usa las que vienen con el sitio.
 */

/**
 * Qué hace con las fotos de arriba el diseño elegido en Portada. Las fotos se guardan igual
 * en los tres: cambiar de diseño no borra ninguna.
 */
const HERO_HINTS: Record<SectionProps["draft"]["heroStyle"], string> = {
  collage: "Van todas, en tiras una al lado de la otra, en el orden de acá abajo. En el celular pasan de a una.",
  photo: "Va la primera de la lista, grande de lado a lado. Las demás quedan guardadas por si se vuelve al collage.",
  text: "Con el diseño Solo el nombre no se muestra ninguna. Quedan guardadas por si se cambia de diseño.",
};

type PhotoSlot = Exclude<ImageSlot, "speciality">;

export function PhotosSection({ draft, set }: SectionProps) {
  const variants = homeVariantsOf({ homeTemplate: draft.homeTemplate, homeVariants: draft.homeVariants ?? {} });
  const gallery = HOME_VARIANTS.gallery.find((option) => option.id === variants.gallery);
  const SLOTS: { id: PhotoSlot; title: string; hint: string }[] = [
    { id: "hero", title: "Portada", hint: `${HERO_HINTS[draft.heroStyle]} Entran hasta ${SLOT_LIMITS.hero}.` },
    {
      id: "gallery",
      title: "Galería",
      hint: `Las fotos del lugar, en el diseño ${gallery?.label.toLowerCase() ?? "elegido"}. Cada una se puede ampliar. Entran hasta ${SLOT_LIMITS.gallery}.`,
    },
  ];

  const photos = draft.photos;

  if (!photos) {
    return (
      <section className="adm-panel cfg-section">
        <div className="adm-empty">No se pudieron cargar las fotos</div>
      </section>
    );
  }

  return (
    <>
      {SLOTS.map((slot) => (
        <section key={slot.id} className="adm-panel cfg-section">
          <h2 className="adm-panel-head">{slot.title}</h2>
          <div className="cfg-photos-body">
            <p className="cfg-lead">
              {slot.hint} Se publican al guardar. Sin fotos publicadas, se usan las que vienen con el sitio.
            </p>
            <SlotPhotos
              slot={slot.id}
              images={photos[slot.id]}
              onChange={(images) => set("photos", { ...photos, [slot.id]: images })}
            />
          </div>
        </section>
      ))}
    </>
  );
}

function SlotPhotos({
  slot,
  images,
  onChange,
}: {
  slot: PhotoSlot;
  images: AdminImage[];
  onChange: (images: AdminImage[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const full = images.length >= SLOT_LIMITS[slot];

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      toast.error(`La foto supera los ${MAX_UPLOAD_MB} MB`);
      return;
    }

    setBusy(true);
    try {
      const image = await uploadImage(slot, file, "");
      onChange([...images, image]);
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  function move(index: number, by: number) {
    const next = [...images];
    const [image] = next.splice(index, 1);
    next.splice(index + by, 0, image);
    onChange(next);
  }

  function describe(id: string, alt: string) {
    onChange(images.map((image) => (image.id === id ? { ...image, alt } : image)));
  }

  return (
    <div className="cfg-photo-grid">
      {images.map((image, index) => (
        <figure key={image.id} className="cfg-photo">
          <img src={imageUrl(image.id, "small")} alt="" style={{ backgroundImage: `url("${image.preview}")` }} />
          {image.pending ? <span className="adm-badge adm-badge-amber cfg-photo-new">Sin guardar</span> : null}
          <label className="ui-field">
            <span>Descripción</span>
            <input
              value={image.alt}
              maxLength={200}
              placeholder="Qué se ve en la foto"
              onChange={(event) => describe(image.id, event.target.value)}
            />
          </label>
          <div className="cfg-photo-actions">
            <button
              type="button"
              className="cfg-move"
              onClick={() => move(index, -1)}
              disabled={index === 0}
              aria-label="Mover antes"
            >
              <FaArrowLeft aria-hidden="true" />
            </button>
            <button
              type="button"
              className="cfg-move"
              onClick={() => move(index, 1)}
              disabled={index === images.length - 1}
              aria-label="Mover después"
            >
              <FaArrowRight aria-hidden="true" />
            </button>
            <ConfirmDelete onConfirm={() => onChange(images.filter((item) => item.id !== image.id))} />
          </div>
        </figure>
      ))}

      {full ? (
        <p className="cfg-photo-full">Ya están las {SLOT_LIMITS[slot]} fotos que entran. Para sumar otra, hay que sacar una.</p>
      ) : (
        <label className={`cfg-photo-add ${busy ? "is-busy" : ""}`}>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            disabled={busy}
            onChange={(event) => upload(event.target.files)}
          />
          <FaPlus aria-hidden="true" />
          <span>{busy ? "Subiendo" : "Subir foto"}</span>
          <small>JPG, PNG, WebP o HEIC, hasta {MAX_UPLOAD_MB} MB</small>
        </label>
      )}
    </div>
  );
}

/**
 * Sacar en dos toques. El primero cambia el botón a "Confirmar" por unos segundos; el
 * segundo la saca del borrador. Hasta guardar se puede recuperar con "Descartar", pero eso
 * deshace también todo lo demás.
 */
function ConfirmDelete({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      className={`cfg-photo-delete ${armed ? "is-armed" : ""}`}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
    >
      <FaTrashCan aria-hidden="true" />
      {armed ? "Confirmar" : "Sacar"}
    </button>
  );
}
