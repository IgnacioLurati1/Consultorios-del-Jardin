import { describe, it, expect } from "vitest";
import { countsOf, explainSuspicion, summarizeSuspicion, type FlaggedPatient } from "./behaviourService.ts";

/**
 * Cómo se le cuenta al admin por qué está marcada una cuenta.
 *
 * Son dos reglas y se entra por cualquiera de las dos, así que lo único que se puede
 * nombrar es la que la persona cruzó. Alguien puede tener 239 asistencias sobre 255 y
 * estar marcado solo por avisar tarde: decir ese 94% ahí lo convierte en un cargo que
 * nadie le hizo.
 */
describe("El motivo de una marca amarilla", () => {
  const base: FlaggedPatient = {
    email: "ana@test.com",
    name: "Ana",
    surname: "Ríos",
    assisted: 239,
    missed: 16,
    closed: 255,
    rate: 0.94,
    lateCancels: 3,
  };

  it("marcado solo por avisar tarde, no nombra la asistencia", () => {
    const patient = { ...base, reasons: ["lateCancels"] as FlaggedPatient['reasons'] };

    expect(summarizeSuspicion(patient)).toBe("Da de baja sobre la hora");
    expect(countsOf(patient)).toBe("3 bajas sobre la hora");
    expect(explainSuspicion(patient)).not.toMatch(/94%/);
    expect(explainSuspicion(patient)).toMatch(/3 turnos con menos de un día/);
  });

  it("marcado solo por faltar, no nombra las bajas", () => {
    const patient = { ...base, assisted: 1, missed: 4, closed: 5, rate: 0.2, lateCancels: 1, reasons: ["missed"] as FlaggedPatient['reasons'] };

    expect(summarizeSuspicion(patient)).toBe("Asistió al 20% de sus turnos");
    expect(countsOf(patient)).toBe("1 vinieron · 4 no");
    expect(explainSuspicion(patient)).not.toMatch(/baja/i);
  });

  it("marcado por las dos cosas, dice las dos", () => {
    const patient = { ...base, assisted: 1, missed: 4, closed: 5, rate: 0.2, reasons: ["missed", "lateCancels"] as FlaggedPatient['reasons'] };

    expect(summarizeSuspicion(patient)).toBe("Asistió al 20% y avisa tarde");
    expect(countsOf(patient)).toBe("1 vinieron · 4 no · 3 bajas sobre la hora");
  });

  it("sin turnos cerrados no inventa un porcentaje", () => {
    const patient = { ...base, assisted: 0, missed: 0, closed: 0, rate: null, reasons: ["lateCancels"] as FlaggedPatient['reasons'] };

    expect(countsOf(patient)).toBe("3 bajas sobre la hora");
    expect(explainSuspicion(patient)).not.toMatch(/%/);
  });

  // El rato entre que sube el servidor y sube la página, y el revés cuando hay que volver
  // atrás una versión. Sin `reasons` se deduce, que es lo que la pantalla hacía antes.
  it("contra un servidor que no manda el motivo, lo deduce", () => {
    const patient = { ...base, lateCancels: undefined };

    expect(summarizeSuspicion(patient)).toBe("Asistió al 94% de sus turnos");
    expect(countsOf(patient)).toBe("239 vinieron · 16 no");
  });

  // Siempre cierra aclarando que no pasa nada, porque el color amarillo solo no lo dice.
  it("siempre aclara que no tiene consecuencia", () => {
    expect(explainSuspicion({ ...base, reasons: ["lateCancels"] })).toMatch(/no tiene ninguna penalización/i);
  });
});
