import { describe, expect, it } from "vitest";
import { DEFAULT_POLICIES, assistantFor, policiesFrom } from "./policies";
import { DEFAULT_SPECIALITY_ICON, suggestIcon } from "./specialityIcons";

describe("las reglas que llegan del servidor", () => {
  it("un servidor anterior a las reglas no manda nada, y vale todo lo de siempre", () => {
    expect(policiesFrom(undefined)).toEqual(DEFAULT_POLICIES);
    expect(policiesFrom(null)).toEqual(DEFAULT_POLICIES);
  });

  it("lo que llega con otro tipo, o una opción que no existe, cae al de siempre", () => {
    const leidas = policiesFrom({ patientBooking: "no", acceptMode: "a veces", proEdit: false, cancelNoticeHours: 24 });

    expect(leidas.patientBooking).toBe(true);
    expect(leidas.acceptMode).toBe("each");
    expect(leidas.proEdit).toBe(false);
    expect(leidas.cancelNoticeHours).toBe(24);
  });
});

describe("para quién está el asistente", () => {
  it("para todos, apagado, o solo para el equipo", () => {
    expect(assistantFor(DEFAULT_POLICIES, "client")).toBe(true);
    expect(assistantFor({ ...DEFAULT_POLICIES, assistant: "off" }, "admin")).toBe(false);
    expect(assistantFor({ ...DEFAULT_POLICIES, assistant: "staff" }, "client")).toBe(false);
    expect(assistantFor({ ...DEFAULT_POLICIES, assistant: "staff" }, "professional")).toBe(true);
  });
});

describe("el ícono que sugiere el nombre de una especialidad", () => {
  it("las de Consultorios del Jardín quedan con los íconos que tenían", () => {
    expect(suggestIcon("Psicología")).toBe("brain");
    expect(suggestIcon("Psicopedagogía")).toBe("book");
    expect(suggestIcon("Psiquiatría")).toBe("stethoscope");
    expect(suggestIcon("Nutrición")).toBe("apple");
    expect(suggestIcon("Fonoaudiología")).toBe("ear");
  });

  it("una nueva toma el que le corresponde, con o sin tildes, y una desconocida el genérico", () => {
    expect(suggestIcon("odontologia")).toBe("tooth");
    expect(suggestIcon("Kinesiología")).toBe("run");
    expect(suggestIcon("Astrología")).toBe(DEFAULT_SPECIALITY_ICON);
  });
});
