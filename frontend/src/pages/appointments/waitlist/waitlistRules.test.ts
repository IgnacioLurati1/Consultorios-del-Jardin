import { describe, it, expect } from "vitest";
import { blockReason, describeDays, formProblem, hourOptions, type WaitlistLimits } from "./waitlistRules.ts";

const limits: WaitlistLimits = {
  maxDays: 3,
  maxHours: 8,
  lifetimeDays: 14,
  maxNotices: 3,
  maxActive: 2,
  maxPerMonth: 5,
  maxPerProfessional: 10,
};

const libre = { enabled: true, full: false, active: [], monthUsed: 0, limits };

describe("La lista de espera, del lado de la pantalla", () => {
  it("dice qué falta antes de dejar mandar", () => {
    expect(formProblem([], "09:00", "12:00", limits)).toMatch(/al menos un día/);
    expect(formProblem([1, 2, 3, 4], "09:00", "12:00", limits)).toMatch(/hasta 3 días/);
    expect(formProblem([1], "12:00", "12:00", limits)).toMatch(/después de la de inicio/);
    expect(formProblem([1], "08:00", "16:30", limits)).toMatch(/hasta 8 horas/);
    expect(formProblem([1, 3], "08:00", "16:00", limits)).toBeNull();
  });

  /*
   * Pasarse del tope del mes cierra la cuenta, así que la pantalla no puede dejar mandarlo
   * nunca: con el tope alcanzado el motivo aparece aunque todo lo demás esté bien.
   */
  it("con el tope del mes alcanzado no deja anotarse, y lo dice antes que cualquier otra cosa", () => {
    expect(blockReason({ ...libre, monthUsed: 5 })).toMatch(/ya te anotaste 5 veces/);
    expect(blockReason({ ...libre, monthUsed: 5, active: [{}, {}], full: true })).toMatch(/ya te anotaste 5 veces/);
  });

  it("frena en dos listas a la vez y con la lista del profesional llena", () => {
    expect(blockReason({ ...libre, active: [{}, {}] })).toMatch(/2 listas de espera/);
    expect(blockReason({ ...libre, full: true })).toMatch(/completa/);
    expect(blockReason({ ...libre, monthUsed: 4, active: [{}] })).toBeNull();
  });

  it("si el profesional no trabaja con lista de espera, es lo único que dice", () => {
    expect(blockReason({ ...libre, enabled: false, monthUsed: 5 })).toBe("Este profesional no trabaja con lista de espera.");
  });

  it("nombra los días como se dicen y ofrece las horas cada media hora", () => {
    expect(describeDays([3, 1])).toBe("lunes y miércoles");
    expect(describeDays([1, 2, 5])).toBe("lunes, martes y viernes");
    expect(hourOptions(8, 9)).toEqual(["08:00", "08:30", "09:00"]);
  });
});
