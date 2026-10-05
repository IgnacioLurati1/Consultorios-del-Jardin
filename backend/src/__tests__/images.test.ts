import { describe, it, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";

// ============================================================
// Las fotos que sube el consultorio.
//
// Se prueba con sharp de verdad y con imágenes armadas acá mismo. Lo que importa es lo que
// se guarda: nunca el archivo que llegó, siempre uno nuevo en WebP, achicado, derecho y sin
// los datos de la cámara.
// ============================================================

const { filas } = vi.hoisted(() => ({ filas: [] as any[] }));

vi.mock("../shared/db/orm.js", () => {
  const em: any = {
    find: vi.fn(async (_e: any, where: any) =>
      filas
        .filter((f) => (!where?.slot || f.slot === where.slot) && (where?.pending === undefined || f.pending === where.pending))
        .sort((a, b) => a.position - b.position)
    ),
    findOne: vi.fn(async (_e: any, where: any, options?: any) => {
      const lista = filas.filter((f) => (where.id ? f.id === where.id : f.slot === where.slot));
      if (options?.orderBy?.position === "DESC") lista.sort((a, b) => b.position - a.position);
      return lista[0] ?? null;
    }),
    count: vi.fn(
      async (_e: any, where: any) =>
        filas.filter((f) => f.slot === where.slot && (where.pending === undefined || f.pending === where.pending)).length
    ),
    nativeDelete: vi.fn(async () => 0),
    create: vi.fn((_e: any, data: any) => {
      filas.push(data);
      return data;
    }),
    remove: vi.fn((row: any) => filas.splice(filas.indexOf(row), 1)),
    flush: vi.fn(async () => {}),
  };
  return { orm: { em: { fork: () => em } } };
});

vi.mock("../installation/installation.service.js", () => ({ forget: vi.fn() }));

import { addImage, imageBytes, listImages, removeImage, savePhotos, SLOT_LIMITS } from "../installation/images.service.js";
import { orm } from "../shared/db/orm.js";

/** Una foto de muestra, del tamaño y el formato que se pidan. */
function foto(width: number, height: number, format: "jpeg" | "png" = "jpeg", orientation?: number) {
  let img = sharp({ create: { width, height, channels: 3, background: { r: 60, g: 120, b: 90 } } });
  img = format === "jpeg" ? img.jpeg() : img.png();
  // La orientación es la que pone la cámara del celular. Con 6, la foto se guardó acostada.
  if (orientation) img = img.withMetadata({ orientation });
  return img.toBuffer();
}

beforeEach(() => {
  filas.length = 0;
});

describe("lo que llega", () => {
  it("un archivo que no es una imagen se rechaza", async () => {
    await expect(addImage(Buffer.from("%PDF-1.4 no soy una foto"), "hero", "")).rejects.toThrow("no es una imagen");
    expect(filas).toHaveLength(0);
  });

  it("un SVG también, aunque sea una imagen: puede llevar código adentro", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
    await expect(addImage(svg, "hero", "")).rejects.toThrow("JPG, PNG, WebP o HEIC");
  });

  it("un lugar que no existe se rechaza", async () => {
    await expect(addImage(await foto(100, 100), "fondo", "")).rejects.toThrow("no existe");
  });
});

describe("lo que se guarda", () => {
  it("es WebP, en dos tamaños, achicado", async () => {
    await addImage(await foto(3000, 2000), "gallery", "La sala de espera");
    const fila = filas[0];

    const grande = await sharp(fila.large).metadata();
    const chica = await sharp(fila.small).metadata();

    expect(grande.format).toBe("webp");
    expect(grande.width).toBe(1600);
    expect(chica.width).toBe(640);
    expect(fila.preview.startsWith("data:image/webp;base64,")).toBe(true);
    expect(fila.alt).toBe("La sala de espera");
  });

  it("una foto chica no se agranda", async () => {
    await addImage(await foto(800, 600, "png"), "hero", "");
    expect((await sharp(filas[0].large).metadata()).width).toBe(800);
  });

  it("una foto de celular acostada se guarda derecha", async () => {
    // 300 de ancho y 200 de alto, pero la cámara dice que hay que girarla 90 grados.
    await addImage(await foto(300, 200, "jpeg", 6), "hero", "");
    const meta = await sharp(filas[0].large).metadata();

    expect([meta.width, meta.height]).toEqual([200, 300]);
  });

  it("no queda ningún dato de la cámara adentro", async () => {
    await addImage(await foto(300, 200, "jpeg", 6), "hero", "");
    const meta = await sharp(filas[0].large).metadata();

    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
  });

  it("la descripción se limpia y se corta", async () => {
    await addImage(await foto(100, 100), "hero", `  Una   descripción\n${"x".repeat(300)}  `);
    expect(filas[0].alt.startsWith("Una descripción x")).toBe(true);
    expect(filas[0].alt.length).toBe(200);
  });
});

describe("los lugares", () => {
  it("una subida queda sin publicar hasta que se guarda", async () => {
    const subida = await addImage(await foto(50, 50), "hero", "");
    expect(subida.pending).toBe(true);
    expect(await listImages()).toHaveLength(0);
  });

  it("no se acumulan más subidas sin guardar que el tope", async () => {
    const chica = await foto(50, 50);
    for (let i = 0; i < SLOT_LIMITS.hero; i++) await addImage(chica, "hero", "");

    await expect(addImage(chica, "hero", "")).rejects.toThrow(`Hay ${SLOT_LIMITS.hero} fotos sin guardar en la portada`);
    // La galería tiene su propio tope.
    await expect(addImage(chica, "gallery", "")).resolves.toBeTruthy();
  });

  it("cada foto nueva va al final", async () => {
    const chica = await foto(50, 50);
    await addImage(chica, "gallery", "");
    await addImage(chica, "gallery", "");
    expect(filas.map((f) => f.position)).toEqual([0, 1]);
  });

  it("al guardar se publican en el orden de la lista, y las que no están se van", async () => {
    const chica = await foto(50, 50);
    const a = await addImage(chica, "gallery", "");
    const b = await addImage(chica, "gallery", "");
    const c = await addImage(chica, "gallery", "");

    await savePhotos(orm.em.fork(), { gallery: [{ id: c.id, alt: "Jardín" }, { id: a.id, alt: "" }] });

    const publicadas = await listImages();
    expect(publicadas.map((f) => f.id)).toEqual([c.id, a.id]);
    expect(publicadas[0].alt).toBe("Jardín");
    expect(filas.some((f) => f.id === b.id)).toBe(false);
  });

  it("una lista con una foto que no existe no se guarda", async () => {
    const a = await addImage(await foto(50, 50), "gallery", "");
    await expect(savePhotos(orm.em.fork(), { gallery: [{ id: a.id }, { id: "inventada" }] })).rejects.toThrow("ya no está");
  });

  it("se sirve por su id, y por la ruta de borrar solo se va una sin guardar", async () => {
    const subida = await addImage(await foto(50, 50), "hero", "");
    expect((await imageBytes(subida.id, "small")).length).toBeGreaterThan(0);

    await removeImage(subida.id);
    await expect(imageBytes(subida.id, "large")).rejects.toThrow("no existe");

    const publicada = await addImage(await foto(50, 50), "hero", "");
    await savePhotos(orm.em.fork(), { hero: [{ id: publicada.id }] });
    await expect(removeImage(publicada.id)).rejects.toThrow("ya está publicada");
  });
});
