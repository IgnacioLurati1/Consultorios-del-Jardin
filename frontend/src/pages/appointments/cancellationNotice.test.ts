import { describe, it, expect } from "vitest";
import { cancellationNotice, formatCancellation, SHORT_NOTICE_HOURS } from "./appointmentTypes.ts";

/**
 * Con cuánta anticipación avisó el paciente que daba de baja el turno.
 *
 * Todo lo de acá se arma con horas locales a propósito. El turno son dos datos separados
 * —el día y la hora de inicio— y la baja es un instante; juntarlos mal corre el resultado
 * tres horas, que es justo lo que decide si la baja entra o no en las 24.
 */
describe("La baja del paciente", () => {
  /** Un turno el 20 de septiembre a las 10, dado de baja `horas` antes. */
  function turno(horas: number | null) {
    const inicio = new Date(2026, 8, 20, 10, 0, 0, 0);

    return {
      date: "2026-09-20",
      initialHour: "10:00",
      patientCancelledAt: horas === null ? null : new Date(inicio.getTime() - horas * 3_600_000).toISOString(),
    };
  }

  it("no dice nada cuando la baja no la hizo el paciente", () => {
    expect(cancellationNotice(turno(null))).toBeNull();
  });

  // Pasa contra un servidor que todavía no tiene el campo, que es lo normal en el rato
  // entre que sube el backend y sube la página.
  it("no dice nada cuando el dato no vino", () => {
    expect(cancellationNotice({ date: "2026-09-20", initialHour: "10:00" })).toBeNull();
  });

  it("marca la baja que llegó con menos de un día", () => {
    const notice = cancellationNotice(turno(5))!;

    expect(notice.short).toBe(true);
    expect(Math.round(notice.hours)).toBe(5);
  });

  it("no marca la baja que avisó con tiempo", () => {
    expect(cancellationNotice(turno(48))!.short).toBe(false);
  });

  // El borde exacto cuenta como aviso suficiente: 24 horas son 24 horas.
  it("justo en el límite no queda marcada", () => {
    const notice = cancellationNotice(turno(SHORT_NOTICE_HOURS))!;

    expect(notice.short).toBe(false);
  });

  // La baja que entra con el turno ya empezado. Es el caso extremo del mismo problema, y
  // la pantalla lo dice distinto, así que tiene que poder distinguirse.
  it("da negativo cuando el aviso llegó después de la hora del turno", () => {
    const notice = cancellationNotice(turno(-2))!;

    expect(notice.short).toBe(true);
    expect(notice.hours).toBeLessThan(0);
  });

  // Sin la copia, calcular la anticipación le cambiaba la hora al turno de quien llamaba.
  it("no le toca la fecha al turno que recibe", () => {
    const date = new Date(2026, 8, 20);
    const antes = date.getTime();

    cancellationNotice({ date, initialHour: "10:00", patientCancelledAt: new Date().toISOString() });

    expect(date.getTime()).toBe(antes);
  });

  it("escribe la fecha y la hora de la baja", () => {
    expect(formatCancellation(new Date(2026, 8, 19, 14, 30))).toBe("19/9 a las 14:30");
  });
});
