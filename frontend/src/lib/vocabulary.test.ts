import { describe, it, expect } from "vitest";
import { DEFAULT_VOCABULARY, vocabularyFrom, words, type Vocabulary } from "./vocabulary.ts";

/**
 * Las palabras del rubro, del lado de la pantalla. Los mismos casos que
 * `appointmentMails.test.ts` del servidor: las dos copias tienen que concordar igual.
 */

const YOGA: Vocabulary = {
  turno: { one: "clase", many: "clases", gender: "f" },
  profesional: { one: "instructora", many: "instructoras", gender: "f" },
  paciente: { one: "alumna", many: "alumnas", gender: "f" },
  lugar: { one: "estudio", many: "estudios", gender: "m" },
  sala: { one: "aula", many: "aulas", gender: "f" },
  especialidad: { one: "disciplina", many: "disciplinas", gender: "f" },
  sucursal: { one: "sede", many: "sedes", gender: "f" },
};

describe("las palabras", () => {
  it("con las de siempre, dicen lo de siempre", () => {
    const w = words();
    expect(`Tu ${w.turno} está confirmad${w.o("turno")}`).toBe("Tu turno está confirmado");
    expect(`Pedir ${w.otro("turno")}`).toBe("Pedir otro turno");
    expect(`Desde ${w.el("lugar")}`).toBe("Desde el consultorio");
    expect(`Mis ${w.turnos}`).toBe("Mis turnos");
  });

  it("con otras, concuerdan", () => {
    const w = words(YOGA);
    expect(`Tu ${w.turno} está confirmad${w.o("turno")}`).toBe("Tu clase está confirmada");
    expect(`Pedir ${w.otro("turno")}`).toBe("Pedir otra clase");
    expect(`Desde ${w.el("lugar")}`).toBe("Desde el estudio");
    expect(w.Los("paciente")).toBe("Las alumnas");
    expect(w.primer("turno")).toBe("primera clase");
  });

  it("lo que llega roto o incompleto toma lo de siempre, palabra por palabra", () => {
    const v = vocabularyFrom({ turno: { one: "cita", many: "citas", gender: "f" }, paciente: { one: "", many: "x", gender: "m" } });
    expect(v.turno.one).toBe("cita");
    expect(v.paciente).toEqual(DEFAULT_VOCABULARY.paciente);
    expect(v.sala).toEqual(DEFAULT_VOCABULARY.sala);
    expect(vocabularyFrom("cualquier cosa")).toEqual(DEFAULT_VOCABULARY);
  });
});
