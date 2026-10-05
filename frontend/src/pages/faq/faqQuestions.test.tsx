import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DEFAULT_INSTALLATION, type Installation } from "../../lib/installation";
import { defaultFaq, defaultReasons, faqFrom, reasonsFrom, visibleReasons, applicationLabel } from "../../lib/contentLists";
import { words } from "../../lib/vocabulary";
import { faqQuestions } from "./faqQuestions";

function with_(change: Partial<Installation>): Installation {
  return { ...DEFAULT_INSTALLATION, ...change };
}

describe("las preguntas frecuentes", () => {
  it("sin nada configurado son las de siempre, en el orden de siempre", () => {
    const questions = faqQuestions(DEFAULT_INSTALLATION);
    expect(questions.map((item) => item.key)).toEqual(defaultFaq().map((item) => item.id));
    expect(questions[3].q).toBe("¿Cuánto cuesta una consulta?");
  });

  it("una oculta no se ve, una reescrita usa el texto nuevo y una propia aparece donde está", () => {
    const faq = faqFrom([
      { id: "p1", question: "¿Hay estacionamiento?", answer: "Sí, en la esquina.\n\nEs gratis.", hidden: false },
      ...defaultFaq().map((item) =>
        item.id === "costo" ? { ...item, hidden: true } : item.id === "datos" ? { ...item, question: "¿Y mis datos?" } : item
      ),
    ]);
    const questions = faqQuestions(with_({ faq }));

    expect(questions[0].q).toBe("¿Hay estacionamiento?");
    expect(questions.some((item) => item.key === "costo")).toBe(false);
    expect(questions.find((item) => item.key === "datos")?.q).toBe("¿Y mis datos?");

    render(<MemoryRouter>{questions[0].a}</MemoryRouter>);
    expect(screen.getByText("Sí, en la esquina.")).toBeTruthy();
    expect(screen.getByText("Es gratis.")).toBeTruthy();
  });

  it("con el motivo para sumarse oculto, la pregunta de sumarse no se ve", () => {
    const contactReasons = defaultReasons().map((item) => (item.id === "profesional" ? { ...item, hidden: true } : item));
    const questions = faqQuestions(with_({ contactReasons }));
    expect(questions.some((item) => item.key === "sumarse")).toBe(false);
  });
});

describe("los motivos de contacto", () => {
  const w = words();

  it("sin nada configurado son los de siempre", () => {
    expect(visibleReasons(defaultReasons(), w).map((item) => item.label)).toEqual([
      "Turnos",
      "Quiero trabajar acá",
      "Sugerencia",
      "Otra consulta",
    ]);
  });

  it("uno renombrado cambia también el link para sumarse, y uno oculto no se ofrece", () => {
    const list = reasonsFrom([
      { id: "profesional", label: "Postulaciones", hint: "", hidden: false },
      { id: "sugerencia", label: "", hint: "", hidden: true },
      { id: "m1", label: "Facturación", hint: "Pedidos de factura.", hidden: false },
    ]);
    expect(applicationLabel(list, w)).toBe("Postulaciones");
    expect(visibleReasons(list, w).map((item) => item.id)).toEqual(["profesional", "m1", "turnos", "otro"]);
  });
});
