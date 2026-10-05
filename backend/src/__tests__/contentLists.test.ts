import { describe, it, expect } from "vitest";
import { defaultFaq, faqOf } from "../shared/faq.js";
import { defaultReasons, reasonLabel, reasonsOf } from "../shared/contactReasons.js";
import { words } from "../shared/vocabulary.js";
import { MAX_LIGHT, readableBackground } from "../shared/elementColors.js";

// ============================================================
// Las preguntas frecuentes y los motivos de contacto, como quedan guardados.
//
// Leer nunca falla: una lista rota o vieja se arregla al leerla en vez de dejar la página
// de preguntas o el formulario sin nada.
// ============================================================

describe("las preguntas guardadas", () => {
  it("sin nada guardado, son las de siempre", () => {
    expect(faqOf(null)).toEqual(defaultFaq());
    expect(faqOf("no es json")).toEqual(defaultFaq());
  });

  it("una de siempre que falta en lo guardado aparece al final", () => {
    const guardadas = defaultFaq()
      .filter((item) => item.id !== "sumarse")
      .reverse();
    const leidas = faqOf(JSON.stringify(guardadas));
    expect(leidas[0].id).toBe("datos");
    expect(leidas.at(-1)).toEqual({ id: "sumarse", question: "", answer: "", hidden: false });
  });

  it("una propia sin respuesta o repetida se saltea", () => {
    const leidas = faqOf(
      JSON.stringify([
        { id: "p1", question: "¿Hay estacionamiento?", answer: "" },
        { id: "p2", question: "¿Hay rampa?", answer: "Sí." },
        { id: "p2", question: "¿Hay rampa?", answer: "Sí." },
      ])
    );
    expect(leidas.filter((item) => item.id.startsWith("p")).map((item) => item.id)).toEqual(["p2"]);
  });
});

describe("los colores propios", () => {
  it("un color oscuro queda igual y uno claro se oscurece lo justo para el texto claro", () => {
    expect(readableBackground("#1e3a5f", MAX_LIGHT.header)).toBe("#1e3a5f");
    const light = readableBackground("#f5d0e0", MAX_LIGHT.header);
    expect(light).not.toBe("#f5d0e0");
    // El mismo tono, más oscuro: el rojo sigue siendo el canal más alto.
    const [r, g, b] = [1, 3, 5].map((start) => parseInt(light.slice(start, start + 2), 16));
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
    expect(Math.max(r, g, b)).toBeLessThan(200);
  });
});

describe("los motivos de contacto", () => {
  const w = words();

  it("los de siempre se llaman como siempre, salvo que se renombren", () => {
    const lista = defaultReasons();
    expect(reasonLabel("turnos", lista, w)).toBe("Turnos");
    expect(reasonLabel("profesional", lista, w)).toBe("Quiero trabajar en el consultorio");

    const renombrada = lista.map((item) => (item.id === "sugerencia" ? { ...item, label: "Ideas" } : item));
    expect(reasonLabel("sugerencia", renombrada, w)).toBe("Ideas");
  });

  it("uno propio se llama como lo escribió el consultorio", () => {
    const lista = reasonsOf(JSON.stringify([...defaultReasons(), { id: "m1", label: "Facturación", hint: "" }]));
    expect(reasonLabel("m1", lista, w)).toBe("Facturación");
  });
});
