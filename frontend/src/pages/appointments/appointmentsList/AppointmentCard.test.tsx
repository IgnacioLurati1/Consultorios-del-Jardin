import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AppointmentCard } from "./AppointmentCard";
import type { Appointment, Person } from "../../types";

/**
 * Que la baja sobre la hora se vea entre los cancelados.
 *
 * Prendiendo "ver los cancelados" quedan todos iguales y en gris, y el que avisó sobre la
 * hora es el único que el profesional está buscando ahí adentro. La clase `late` es lo que
 * le da el color; sin ella el renglón se pierde entre los otros diez.
 */

const LUIS: Person = {
  email: "luis@test.com",
  docType: "DNI",
  docNumber: "20000000",
  name: "Luis",
  surname: "Peralta",
  phoneNumber: "3410000000",
  speciality: "Nutrición",
  type: "professional",
  active: true,
};

const MARTA: Person = { ...LUIS, email: "marta@test.com", name: "Marta", surname: "Gómez", type: "client", speciality: "" };

/** Otra profesional del consultorio, la que atiende a Luis cuando le toca a él. */
const ANA: Person = { ...LUIS, email: "ana@test.com", name: "Ana", surname: "Ruiz", speciality: "Psicología" };

/** Un turno dado de baja. `cancelledAt` en null es una baja del profesional. */
function turno(cancelledAt: string | null, hours = 2): Appointment {
  const empieza = new Date(Date.now() + hours * 60 * 60 * 1000);
  const dia = `${empieza.getFullYear()}-${String(empieza.getMonth() + 1).padStart(2, "0")}-${String(
    empieza.getDate()
  ).padStart(2, "0")}`;

  return {
    numAppointment: 1,
    date: dia,
    initialHour: `${String(empieza.getHours()).padStart(2, "0")}:00:00`,
    finalHour: `${String(empieza.getHours() + 1).padStart(2, "0")}:00:00`,
    value: 5000,
    // Cancelar guarda un ISO timestamp en el estado, así que esto es "cancelado".
    state: "2026-09-08T12:00:00.000Z",
    patient: MARTA,
    professional: LUIS,
    room: { idRoom: "1", description: "Sala", office: { description: "Consultorio" } },
    patientCancelledAt: cancelledAt,
  } as unknown as Appointment;
}

function dibujar(appointment: Appointment, user: Person) {
  const { container } = render(<AppointmentCard appointment={appointment} user={user} onOpen={() => {}} />);
  return container.querySelector(".appt-card")!;
}

describe("La tarjeta de un turno dado de baja", () => {
  it("marca la baja que llegó sobre la hora", () => {
    const tarjeta = dibujar(turno(new Date().toISOString()), LUIS);

    expect(tarjeta.className).toContain("state-cancelled");
    expect(tarjeta.className).toContain("late");
    expect(screen.getByText("Baja con poco aviso")).toBeTruthy();
  });

  it("no marca la que avisó con tiempo", () => {
    // El turno es dentro de diez días y avisó ahora: sobra el día de anticipación.
    const tarjeta = dibujar(turno(new Date().toISOString(), 240), LUIS);

    expect(tarjeta.className).toContain("state-cancelled");
    expect(tarjeta.className).not.toContain("late");
    expect(screen.queryByText("Baja con poco aviso")).toBeNull();
  });

  // Del lado del profesional una baja suya no es algo para revisar después, así que no se
  // guarda cuándo la hizo y no hay nada que marcar.
  it("no marca la baja que hizo el profesional", () => {
    const tarjeta = dibujar(turno(null), LUIS);

    expect(tarjeta.className).not.toContain("late");
  });

  /*
   * La marca es para el profesional, que es quien decide qué hacer con eso. Al paciente no
   * se le pone un cartel encima de algo que ya hizo.
   */
  it("al paciente no le muestra la marca", () => {
    const tarjeta = dibujar(turno(new Date().toISOString()), MARTA);

    expect(tarjeta.className).not.toContain("late");
    expect(screen.queryByText("Baja con poco aviso")).toBeNull();
  });

  /*
   * El servidor y la página se publican por separado. Contra un servidor todavía sin este
   * dato el turno tiene que dibujarse igual, sin la marca.
   */
  it("sin el dato, la tarjeta se dibuja igual", () => {
    const sinDato = turno(null);
    delete (sinDato as { patientCancelledAt?: unknown }).patientCancelledAt;

    const tarjeta = dibujar(sinDato, LUIS);

    expect(tarjeta.className).toContain("state-cancelled");
    expect(tarjeta.className).not.toContain("late");
  });
});

/**
 * El turno que el profesional sacó para atenderse él.
 *
 * En su agenda es el único donde no es quien atiende, y hasta que existió la marca dorada
 * se leía como un paciente más de su propia lista. Peor todavía, el nombre que mostraba
 * era el del casillero "paciente", o sea el suyo.
 */
describe("La tarjeta de un turno propio", () => {
  function turnoPropio(): Appointment {
    return { ...turno(null), state: "accepted", patient: LUIS, professional: ANA } as Appointment;
  }

  it("lo marca en dorado y dice quién lo atiende", () => {
    const tarjeta = dibujar(turnoPropio(), LUIS);

    expect(tarjeta.className).toContain("own");
    expect(screen.getByText("Turno propio")).toBeTruthy();
    expect(screen.getByText("Ruiz, Ana")).toBeTruthy();
    expect(screen.queryByText("Peralta, Luis")).toBeNull();
  });

  it("el turno que da sigue siendo el de siempre", () => {
    const tarjeta = dibujar({ ...turno(null), state: "accepted" } as Appointment, LUIS);

    expect(tarjeta.className).not.toContain("own");
    expect(screen.getByText("Gómez, Marta")).toBeTruthy();
  });
});
