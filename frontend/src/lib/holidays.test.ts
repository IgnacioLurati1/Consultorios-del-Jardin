import { describe, expect, it } from "vitest";
import { holidayOf } from "./holidays";

/** Un instante dado en hora argentina, que es como se lee todo acá. */
function enArgentina(iso: string): Date {
  return new Date(`${iso}-03:00`);
}

describe("holidayOf", () => {
  it("no adorna nada el resto del año", () => {
    expect(holidayOf(enArgentina("2026-06-15T12:00:00"))).toBe(null);
    expect(holidayOf(enArgentina("2026-09-01T12:00:00"))).toBe(null);
    expect(holidayOf(enArgentina("2026-11-30T23:00:00"))).toBe(null);
  });

  it("reconoce cada fecha", () => {
    expect(holidayOf(enArgentina("2026-12-10T12:00:00"))).toBe("navidad");
    expect(holidayOf(enArgentina("2026-02-10T12:00:00"))).toBe("carnaval");
    expect(holidayOf(enArgentina("2026-04-01T12:00:00"))).toBe("pascua");
  });

  it("toma los dos extremos del rango", () => {
    expect(holidayOf(enArgentina("2026-12-01T00:00:00"))).toBe("navidad");
    expect(holidayOf(enArgentina("2026-12-25T23:59:00"))).toBe("navidad");
    expect(holidayOf(enArgentina("2026-12-26T00:00:00"))).toBe(null);

    expect(holidayOf(enArgentina("2026-02-01T00:00:00"))).toBe("carnaval");
    expect(holidayOf(enArgentina("2026-02-17T23:59:00"))).toBe("carnaval");
    expect(holidayOf(enArgentina("2026-02-18T00:00:00"))).toBe(null);

    // Pascua cruza de mes: el rango tiene que valer de los dos lados.
    expect(holidayOf(enArgentina("2026-03-28T23:59:00"))).toBe(null);
    expect(holidayOf(enArgentina("2026-03-29T00:00:00"))).toBe("pascua");
    expect(holidayOf(enArgentina("2026-03-31T12:00:00"))).toBe("pascua");
    expect(holidayOf(enArgentina("2026-04-05T23:59:00"))).toBe("pascua");
    expect(holidayOf(enArgentina("2026-04-06T00:00:00"))).toBe(null);
  });

  it("mide en Argentina y no en el reloj de quien mira", () => {
    // Las 22 del 30 de noviembre acá es la una de la mañana del 1 en Londres: todavía no
    // hay adornos.
    expect(holidayOf(new Date("2026-12-01T01:00:00Z"))).toBe(null);
    expect(holidayOf(new Date("2026-12-01T04:00:00Z"))).toBe("navidad");
  });
});
