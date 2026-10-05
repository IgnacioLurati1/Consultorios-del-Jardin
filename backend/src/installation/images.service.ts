import crypto from "node:crypto";
import sharp from "sharp";
import { orm } from "../shared/db/orm.js";
import { badRequest, conflict, notFound } from "../shared/errors.js";
import { SiteImage } from "./siteImage.entity.js";

/**
 * Las fotos de la portada que sube el consultorio.
 *
 * Lo que llega nunca se guarda tal cual. Se lee con sharp —si no es una imagen de verdad,
 * ahí se corta—, se gira según lo que diga la cámara, se achica y se vuelve a escribir en
 * WebP. Lo que queda es una imagen nueva: sin los datos de la cámara ni la ubicación de la
 * foto, que un celular guarda adentro y que no tienen por qué terminar publicados, y sin
 * nada de lo que un archivo armado a propósito pudiera traer escondido.
 */

export const IMAGE_SLOTS = ["hero", "gallery", "speciality"] as const;
export type ImageSlot = (typeof IMAGE_SLOTS)[number];

/** Cuántas fotos entran en cada lugar. La portada muestra cinco a la vez; la galería, en tandas. */
export const SLOT_LIMITS: Record<ImageSlot, number> = { hero: 5, gallery: 12, speciality: 30 };

const SLOT_NAMES: Record<ImageSlot, string> = { hero: "la portada", gallery: "la galería", speciality: "las especialidades" };

/** El tope del archivo que se sube. Una foto de celular pesa entre 2 y 6 MB. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Lo más grande que se acepta como imagen de origen, para no quedarse sin memoria. */
const MAX_PIXELS = 50_000_000;

const LARGE_WIDTH = 1600;
const SMALL_WIDTH = 640;
const PREVIEW_WIDTH = 24;

/** Lo que se cuenta de una foto sin sus bytes. */
export interface ImageInfo {
  id: string;
  slot: ImageSlot;
  position: number;
  alt: string;
  width: number;
  height: number;
  preview: string;
  /** Subida y sin guardar todavía. */
  pending: boolean;
}

function infoOf(image: SiteImage): ImageInfo {
  return {
    id: image.id,
    slot: image.slot as ImageSlot,
    position: image.position,
    alt: image.alt,
    width: image.width,
    height: image.height,
    preview: image.preview,
    pending: !!image.pending,
  };
}

function parseSlot(value: unknown): ImageSlot {
  if (!(IMAGE_SLOTS as readonly string[]).includes(String(value))) throw badRequest("Ese lugar de la portada no existe");
  return value as ImageSlot;
}

function cleanAlt(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/** Las fotos publicadas de un lugar, o de todos, en orden. Las que están sin guardar no. */
export async function listImages(slot?: ImageSlot): Promise<ImageInfo[]> {
  const em = orm.em.fork();
  const rows = await em.find(SiteImage, slot ? { slot, pending: false } : { pending: false }, {
    orderBy: { slot: "ASC", position: "ASC" },
  });
  return rows.map(infoOf);
}

/** Lo que vive una foto subida y no guardada. Pasado eso nadie la va a guardar: se borra. */
const PENDING_TTL_MS = 6 * 60 * 60 * 1000;

async function prunePending(em: ReturnType<typeof orm.em.fork>): Promise<void> {
  await em.nativeDelete(SiteImage, { pending: true, createdAt: { $lt: new Date(Date.now() - PENDING_TTL_MS) } });
}

/**
 * Sube una foto: la lee, la vuelve a escribir en dos tamaños y la guarda al final de su lugar.
 *
 * `file` es lo que dejó multer en memoria. El tamaño ya lo cortó multer; acá se corta todo lo
 * que no sea una imagen, y las imágenes absurdamente grandes.
 */
export async function addImage(file: Buffer, slotValue: unknown, altValue: unknown): Promise<ImageInfo> {
  const slot = parseSlot(slotValue);
  const em = orm.em.fork();

  await prunePending(em);

  // El tope de verdad se controla al guardar, con la lista final. Acá solo se frena que
  // se acumulen subidas sin guardar.
  const count = await em.count(SiteImage, { slot, pending: true });
  if (count >= SLOT_LIMITS[slot])
    throw conflict(`Hay ${SLOT_LIMITS[slot]} fotos sin guardar en ${SLOT_NAMES[slot]}. Hay que guardar o descartar antes`);

  let source: sharp.Sharp;
  let meta: sharp.Metadata;
  try {
    source = sharp(file, { limitInputPixels: MAX_PIXELS, failOn: "error" });
    meta = await source.metadata();
  } catch {
    throw badRequest("El archivo no es una imagen");
  }

  if (!meta.format || !["jpeg", "png", "webp", "heif", "avif", "gif", "tiff"].includes(meta.format))
    throw badRequest("La foto tiene que ser JPG, PNG, WebP o HEIC");

  // `rotate()` sin argumentos la endereza según lo que guardó la cámara, antes de que esos
  // datos se pierdan al volver a escribirla. Sin esto, una foto de celular vertical se
  // publica acostada.
  const upright = sharp(file, { limitInputPixels: MAX_PIXELS }).rotate();

  let large: { data: Buffer; info: sharp.OutputInfo };
  let small: Buffer;
  let preview: Buffer;
  try {
    large = await upright
      .clone()
      .resize({ width: LARGE_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    small = await upright.clone().resize({ width: SMALL_WIDTH, withoutEnlargement: true }).webp({ quality: 74 }).toBuffer();
    preview = await upright.clone().resize({ width: PREVIEW_WIDTH }).webp({ quality: 40 }).toBuffer();
  } catch {
    throw badRequest("No se pudo leer la foto");
  }

  const last = await em.findOne(SiteImage, { slot }, { orderBy: { position: "DESC" } });

  const image = em.create(SiteImage, {
    id: crypto.randomBytes(12).toString("hex"),
    slot,
    position: (last?.position ?? -1) + 1,
    alt: cleanAlt(altValue),
    width: large.info.width,
    height: large.info.height,
    large: large.data,
    small,
    preview: `data:image/webp;base64,${preview.toString("base64")}`,
    pending: true,
    createdAt: new Date(),
  });

  await em.flush();
  return infoOf(image);
}

/** Los bytes de una foto, para servirla. */
export async function imageBytes(id: string, size: "large" | "small"): Promise<Buffer> {
  const em = orm.em.fork();
  const image = await em.findOne(SiteImage, { id: String(id) }, { populate: [size] as any });
  if (!image) throw notFound("Esa foto no existe");
  return size === "large" ? image.large : image.small;
}

/**
 * Borra una foto subida que no se guardó: es lo que hace "Descartar" en la configuración.
 *
 * Una publicada no se borra por acá. Se saca de la lista en la configuración y se va al
 * guardar, junto con el resto: si se borrara al tocar el tacho, "Descartar" ya no podría
 * devolverla.
 */
export async function removeImage(id: string): Promise<void> {
  const em = orm.em.fork();
  const image = await em.findOne(SiteImage, { id: String(id) });
  if (!image) throw notFound("Esa foto no existe");
  if (!image.pending) throw conflict("Esa foto ya está publicada. Se saca desde la configuración, al guardar");

  em.remove(image);
  await em.flush();
}

/**
 * Las fotos de la portada y de la galería, como quedan al guardar la configuración.
 *
 * Llega la lista entera de cada lugar, en orden y con su descripción. Las que están se
 * publican en ese orden; las de ese lugar que no están (publicadas o recién subidas) se
 * borran. Corre adentro del guardado de la configuración (ver updateConfig), así que va
 * todo junto o nada: no queda una foto publicada con la configuración vieja.
 */
export async function savePhotos(em: ReturnType<typeof orm.em.fork>, value: unknown): Promise<void> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw badRequest("Las fotos llegaron con un formato que no se entiende");

  for (const [slotKey, list] of Object.entries(value as Record<string, unknown>)) {
    const slot = parseSlot(slotKey);
    if (slot === "speciality") throw badRequest("Las fotos de las especialidades van con cada especialidad");
    if (!Array.isArray(list)) throw badRequest("Las fotos llegaron con un formato que no se entiende");
    if (list.length > SLOT_LIMITS[slot]) throw badRequest(`Entran hasta ${SLOT_LIMITS[slot]} fotos en ${SLOT_NAMES[slot]}`);

    const rows = await em.find(SiteImage, { slot });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const ids = list.map((item) => String((item as { id?: unknown })?.id ?? ""));
    if (new Set(ids).size !== ids.length || ids.some((id) => !byId.has(id)))
      throw conflict("Una de las fotos ya no está. Hay que volver a cargar la pantalla");

    list.forEach((item, index) => {
      const row = byId.get(ids[index])!;
      row.position = index;
      row.alt = cleanAlt((item as { alt?: unknown })?.alt);
      row.pending = false;
    });
    for (const row of rows) if (!ids.includes(row.id)) em.remove(row);
  }
}

