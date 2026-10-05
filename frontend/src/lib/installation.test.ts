import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_INSTALLATION,
  bookingWindowText,
  currentInstallation,
  directionsOf,
  fullAddress,
  loadInstallation,
  mapEmbedOf,
  resetInstallationForTests,
} from "./installation.ts";

/**
 * La configuración del consultorio, del lado de la pantalla.
 *
 * Lo que se prueba es el plan B. La pantalla y el servidor se publican por separado, así que
 * esta versión puede hablar con un servidor que todavía no tiene la ruta, o que no manda
 * algún campo, o que lo manda mal. En todos esos casos tiene que quedar lo de siempre, que
 * es lo que estaba escrito antes de que existiera la configuración.
 */

function responde(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, json: async () => body }))
  );
}

beforeEach(() => resetInstallationForTests());
afterEach(() => {
  vi.unstubAllGlobals();
  resetInstallationForTests();
});

describe("cuando el servidor no ayuda", () => {
  it("antes de preguntar, lo de siempre", () => {
    expect(currentInstallation()).toEqual(DEFAULT_INSTALLATION);
  });

  it("un servidor viejo sin la ruta deja lo de siempre", async () => {
    responde({ message: "Resource not found" }, false);
    expect(await loadInstallation()).toEqual(DEFAULT_INSTALLATION);
  });

  it("sin red, lo de siempre, y no tira", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("sin red"))));
    await expect(loadInstallation()).resolves.toEqual(DEFAULT_INSTALLATION);
  });

  it("un campo con el tipo equivocado toma el de siempre, los demás llegan", async () => {
    responde({ data: { name: "Centro Sur", rules: { bookingWeeksAhead: "dos", shortNoticeHours: 12 } } });

    const c = await loadInstallation();
    expect(c.name).toBe("Centro Sur");
    expect(c.rules.bookingWeeksAhead).toBe(1);
    expect(c.rules.shortNoticeHours).toBe(12);
  });

  it("los campos que el servidor todavía no manda quedan como estaban", async () => {
    responde({ data: { name: "Centro Sur" } });

    const c = await loadInstallation();
    expect(c.heroStyle).toBe("collage");
    expect(c.homeBlocks).toEqual(DEFAULT_INSTALLATION.homeBlocks);
    expect(c.services).toEqual(DEFAULT_INSTALLATION.services);
  });

  it("un bloque que esta versión no sabe dibujar se descarta, sin romper la portada", async () => {
    responde({ data: { homeBlocks: { guest: ["hero", "carrusel3d", "footer"], member: ["hero"] } } });

    const c = await loadInstallation();
    expect(c.homeBlocks.guest).toEqual(["hero", "footer"]);
  });

  it("pregunta una sola vez aunque la pidan varias pantallas a la vez", async () => {
    responde({ data: { name: "Centro Sur" } });

    await Promise.all([loadInstallation(), loadInstallation(), loadInstallation()]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("el color de la marca", () => {
  it("sin marca, la estación", async () => {
    responde({ data: { brand: { hue: null, saturation: null } } });
    expect((await loadInstallation()).brand).toBe(null);
  });

  it("con marca, el tono fijo", async () => {
    responde({ data: { brand: { hue: 210, saturation: 40 } } });
    expect((await loadInstallation()).brand).toEqual({ hue: 210, saturation: 40 });
  });
});

describe("la dirección y el mapa", () => {
  it("la dirección completa lleva la ciudad", () => {
    expect(fullAddress(DEFAULT_INSTALLATION)).toBe("9 de Julio 3672, Rosario");
  });

  it("con el mapa que pegó el consultorio, ese", () => {
    expect(mapEmbedOf(DEFAULT_INSTALLATION)).toContain("google.com/maps/embed");
  });

  it("sin mapa, uno armado con la dirección", () => {
    const sinMapa = { ...DEFAULT_INSTALLATION, mapEmbedUrl: null, directionsUrl: null, address: "Av. Colón 1200", city: "Córdoba" };

    expect(mapEmbedOf(sinMapa)).toBe("https://maps.google.com/maps?q=Av.%20Col%C3%B3n%201200%2C%20C%C3%B3rdoba&output=embed");
    expect(directionsOf(sinMapa)).toContain("destination=Av.%20Col%C3%B3n%201200");
  });
});

describe("cómo se dice el horizonte", () => {
  it("con el de siempre, lo que estaba escrito", () => {
    expect(bookingWindowText(1)).toEqual({ sub: "hasta dos semanas en adelante", empty: "en las próximas dos semanas" });
  });

  it("con cero, solo esta semana", () => {
    expect(bookingWindowText(0).sub).toBe("solo esta semana");
  });

  it("más allá de doce, con número", () => {
    expect(bookingWindowText(20).sub).toBe("hasta 21 semanas en adelante");
  });
});
