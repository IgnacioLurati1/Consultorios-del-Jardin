import { describe, it, expect } from "vitest";
import { deletionDateFor, deletionThisMonth } from "./accountDeletion";

/**
 * La fecha que anuncia la pantalla antes de deshabilitar una cuenta.
 *
 * Tiene que dar lo mismo que la limpieza del servidor (accountCleanup.ts): si una dice
 * una fecha y la otra borra en otra, el administrador se entera cuando ya no hay nada.
 */
const iso = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

describe("cuándo se borra una cuenta deshabilitada", () => {
  it("una baja de principio de mes se borra a fin de ese mes", () => {
    expect(iso(deletionDateFor(new Date(2026, 8, 1)))).toBe("2026-9-30");
  });

  it("una baja de la segunda quincena se borra a fin del mes siguiente", () => {
    expect(iso(deletionDateFor(new Date(2026, 8, 17)))).toBe("2026-10-31");
  });

  it("enero cae en febrero, con los días que tenga", () => {
    expect(iso(deletionDateFor(new Date(2026, 0, 31)))).toBe("2026-2-28");
  });

  it("sabe si la fecha es de este mes o del que viene", () => {
    const hoy = new Date();
    const principio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

    expect(deletionThisMonth(principio)).toBe(true);
    expect(deletionThisMonth(fin)).toBe(false);
  });
});
