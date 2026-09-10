import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { GridModule } from "./gridModule.tsx";
import { daysSpanish } from "../scheduleTypes.ts";

/**
 * Las horas al costado de la grilla de horarios.
 *
 * Una por fila, desde la apertura hasta la última hora antes del cierre: con el
 * consultorio de 8 a 21, la última fila es la de las 20, que termina a las 21.
 */
describe("La grilla de horarios", () => {
  it("tiene una hora por fila, de la apertura hasta antes del cierre", () => {
    const { container } = render(
      <GridModule
        schedules={[]}
        daysSpanish={daysSpanish}
        openingTime="08:00"
        closingTime="21:00"
        setScheduleModalOpen={vi.fn()}
        setSelectedSchedule={vi.fn()}
        setSelectedKey={vi.fn()}
      />
    );

    const horas = Array.from(container.querySelectorAll(".hour-label")).map((label) => label.textContent);

    expect(horas).toHaveLength(13);
    expect(horas[0]).toBe("08:00");
    expect(horas[12]).toBe("20:00");
  });
});
