import { describe, expect, it } from "vitest";
import { nextSeason, seasonOf } from "./SeasonContext";

/** Un instante dado en hora argentina, que es como se lee todo acá. */
function enArgentina(iso: string): Date {
  return new Date(`${iso}-03:00`);
}

describe("seasonOf", () => {
  it("pone cada estación en su trimestre", () => {
    expect(seasonOf(enArgentina("2026-01-15T12:00:00"))).toBe("verano");
    expect(seasonOf(enArgentina("2026-04-15T12:00:00"))).toBe("otono");
    expect(seasonOf(enArgentina("2026-07-15T12:00:00"))).toBe("invierno");
    expect(seasonOf(enArgentina("2026-10-15T12:00:00"))).toBe("primavera");
  });

  it("cambia el día 21 y no el 20", () => {
    expect(seasonOf(enArgentina("2026-03-20T23:00:00"))).toBe("verano");
    expect(seasonOf(enArgentina("2026-03-21T00:00:00"))).toBe("otono");

    expect(seasonOf(enArgentina("2026-06-20T23:00:00"))).toBe("otono");
    expect(seasonOf(enArgentina("2026-06-21T00:00:00"))).toBe("invierno");

    expect(seasonOf(enArgentina("2026-09-20T23:00:00"))).toBe("invierno");
    expect(seasonOf(enArgentina("2026-09-21T00:00:00"))).toBe("primavera");

    expect(seasonOf(enArgentina("2026-12-20T23:00:00"))).toBe("primavera");
    expect(seasonOf(enArgentina("2026-12-21T00:00:00"))).toBe("verano");
  });

  it("mide en Argentina y no en el reloj de quien mira", () => {
    // Las 22 del 20 de septiembre acá son la una de la mañana del 21 en Londres. La
    // página tiene que seguir en invierno: la estación es la del consultorio.
    expect(seasonOf(new Date("2026-09-21T01:00:00Z"))).toBe("invierno");

    // Y al revés: a la una de la mañana del 21 acá, en Tokio ya es media tarde.
    expect(seasonOf(new Date("2026-09-21T04:00:00Z"))).toBe("primavera");
  });
});

describe("nextSeason", () => {
  it("sigue el calendario y da la vuelta", () => {
    expect(nextSeason("verano")).toBe("otono");
    expect(nextSeason("otono")).toBe("invierno");
    expect(nextSeason("invierno")).toBe("primavera");
    expect(nextSeason("primavera")).toBe("verano");
  });

  it("con cuatro toques vuelve a donde estaba", () => {
    let season = seasonOf(new Date());
    const arranque = season;

    for (let i = 0; i < 4; i++) season = nextSeason(season);

    expect(season).toBe(arranque);
  });
});
