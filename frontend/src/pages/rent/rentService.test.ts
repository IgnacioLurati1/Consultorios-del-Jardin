import { describe, expect, it } from "vitest";
import { formatAdjust, isMonthKey, monthName, parseMoney, shiftMonth, toLocalDate } from "./rentService";

describe("alquileres - ayudas de pantalla", () => {
  it("se mueve entre meses cruzando el año", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(monthName("2026-09")).toBe("septiembre 2026");
  });

  it("solo acepta meses que existen", () => {
    expect(isMonthKey("2026-09")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("septiembre")).toBe(false);
    expect(isMonthKey(null)).toBe(false);
  });

  it("los montos van en pesos enteros", () => {
    expect(parseMoney("30000")).toBe(30000);
    expect(parseMoney(" 0 ")).toBe(0);
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("10.5")).toBeNull();
    expect(parseMoney("-3")).toBeNull();
  });

  it("escribe las fechas como se leen acá, sin pasar por Date", () => {
    expect(toLocalDate("2026-09-05")).toBe("05/09/2026");
    expect(toLocalDate(null)).toBe("");
  });

  it("muestra el ajuste propio en porcentaje", () => {
    expect(formatAdjust(1000)).toBe("+10%");
    expect(formatAdjust(1550)).toBe("+15.50%");
  });
});
