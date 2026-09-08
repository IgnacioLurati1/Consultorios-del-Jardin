import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import type { Appointment, Person } from "../types";

/**
 * El historial que se muestra tiene que ser el del paciente que está abierto.
 *
 * Abrir una ficha, cerrarla y abrir otra dispara dos pedidos sin esperar al primero, y
 * nada garantiza que el servidor los conteste en orden. Antes ganaba el que llegaba
 * último: la ficha de una persona terminaba mostrando el historial clínico de otra, con
 * su nombre arriba. Es lo peor que puede pasar en esta pantalla, así que queda probado.
 */

const { traerHistorial } = vi.hoisted(() => ({ traerHistorial: vi.fn() }));

const paciente = (email: string, name: string): Person => ({
  email,
  docType: "DNI",
  docNumber: "30000000",
  name,
  surname: "Apellido",
  phoneNumber: "3410000000",
  speciality: "",
  type: "client",
  active: true,
});

const MARTA = paciente("marta@test.com", "Marta");
const JULIA = paciente("julia@test.com", "Julia");

/** Un turno atendido, que es lo que cuenta el recorte "Asistió" del historial. */
const atendido = (num: number): Appointment =>
  ({
    numAppointment: num,
    date: "2026-09-01",
    initialHour: "10:00:00",
    finalHour: "11:00:00",
    value: 1000,
    state: "assisted",
    professional: { email: "luis@test.com", name: "Luis", surname: "Peralta" },
    room: { idRoom: "1", description: "Sala" },
  }) as unknown as Appointment;

/** Marta tiene un turno atendido; Julia tiene tres. Así se distinguen de un vistazo. */
const HISTORIALES: Record<string, Appointment[]> = {
  "marta@test.com": [atendido(1)],
  "julia@test.com": [atendido(2), atendido(3), atendido(4)],
};

vi.mock("./patientsService.ts", () => ({
  findAllPatients: vi.fn(() => Promise.resolve([])),
  findMyPatients: vi.fn(() => Promise.resolve([MARTA, JULIA])),
  createAnonymousPatient: vi.fn(),
  deleteAnonymousPatient: vi.fn(),
  updatePatient: vi.fn(),
}));

vi.mock("../appointments/appointmentsService.ts", () => ({ getPatientMedicalHistory: traerHistorial }));

vi.mock("../commonServices.ts", () => ({
  findPerson: vi.fn(() => Promise.resolve({ email: "luis@test.com", type: "professional" })),
  getDecodedToken: () => ({ email: "luis@test.com", type: "professional" }),
}));

vi.mock("./ContactPatientModal.tsx", () => ({ ContactPatientModal: () => null }));

import { PatientsPage } from "./PatientsPage";

/**
 * Cuántos turnos atendidos dice el recorte "Asistió" que hay en el historial abierto.
 *
 * Se busca adentro de la fila de recortes y no en toda la pantalla: cada renglón del
 * historial también es un botón y también dice "Asistió" en su cartel de estado.
 */
async function asistidosMostrados(): Promise<string | null> {
  const recortes = await screen.findByRole("group", { name: "Filtrar el historial" });
  const boton = await within(recortes).findByRole("button", { name: /Asistió/ });
  return boton.textContent?.replace(/\D/g, "") ?? null;
}

describe("El historial de la ficha del paciente", () => {
  beforeEach(() => {
    traerHistorial.mockReset();
    localStorage.clear();
  });

  it("muestra el del paciente que está abierto", async () => {
    traerHistorial.mockImplementation((email: string) => Promise.resolve(HISTORIALES[email] ?? []));

    render(
      <BrowserRouter>
        <PatientsPage />
      </BrowserRouter>
    );

    await userEvent.click(await screen.findByRole("button", { name: /Julia/ }));
    await waitFor(async () => expect(await asistidosMostrados()).toBe("3"));
  });

  // El caso que rompía. La primera respuesta llega tarde, cuando la ficha ya es otra.
  it("descarta el historial que llega tarde, cuando la ficha ya es de otra persona", async () => {
    traerHistorial.mockImplementation(
      (email: string) =>
        new Promise((resolve) => setTimeout(() => resolve(HISTORIALES[email] ?? []), email === MARTA.email ? 600 : 0))
    );

    render(
      <BrowserRouter>
        <PatientsPage />
      </BrowserRouter>
    );

    // Se abre Marta (su historial va a tardar), se cierra y se abre Julia.
    await userEvent.click(await screen.findByRole("button", { name: /Marta/ }));
    await userEvent.keyboard("{Escape}");
    await userEvent.click(await screen.findByRole("button", { name: /Julia/ }));

    await waitFor(async () => expect(await asistidosMostrados()).toBe("3"));

    // Y sigue siendo el de Julia después de que llega el de Marta.
    await new Promise((resolve) => setTimeout(resolve, 900));
    expect(await asistidosMostrados()).toBe("3");
    expect(traerHistorial).toHaveBeenCalledTimes(2);
  });
});
