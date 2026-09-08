import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { traerHorarios } = vi.hoisted(() => ({ traerHorarios: vi.fn() }));

vi.mock("../appointmentsService.ts", () => ({
  getAvailableAppointmentsForPatient: traerHorarios,
  createAppointment: vi.fn(),
}));

import { ProfessionalSchedule } from "./ProfessionalSchedule.tsx";
import type { City, Office, Person } from "../../types.ts";

/**
 * Qué le decimos al paciente cuando no pudimos traer la agenda.
 *
 * Antes el servicio devolvía una lista vacía ante cualquier error y la pantalla no tenía
 * cómo distinguir "no le queda lugar" de "no lo pudimos preguntar". Con el servidor caído
 * le decía al paciente que el profesional no tenía horarios, que es lo contrario de
 * pedirle que vuelva a intentar: el paciente se iba y el turno se perdía.
 */
describe("Los horarios de un profesional", () => {
  const professional = { email: "ana@test.com", name: "Ana", surname: "Ríos", speciality: "Psicología" } as Person;
  const office: Office = {
    idOffice: "1",
    description: "Central",
    openingTime: "08:00",
    closingTime: "20:00",
    city: { idCity: "1", nameCity: "Rosario" } as City,
    active: true,
  };

  beforeEach(() => {
    traerHorarios.mockReset();
  });

  it("cuando no se pudo consultar, no dice que no hay lugar", async () => {
    traerHorarios.mockRejectedValue(new Error("Se cayó la base"));

    render(<ProfessionalSchedule professional={professional} office={office} />);

    await waitFor(() => expect(screen.getByText(/no pudimos traer la agenda/i)).toBeInTheDocument());
    expect(screen.queryByText(/no tiene horarios libres/i)).not.toBeInTheDocument();
  });

  it("cuando de verdad no queda lugar, lo dice y no ofrece reintentar", async () => {
    traerHorarios.mockResolvedValue([]);

    render(<ProfessionalSchedule professional={professional} office={office} />);

    await waitFor(() => expect(screen.getByText(/no tiene horarios libres/i)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /probar de nuevo/i })).not.toBeInTheDocument();
  });

  // Volver a preguntar es lo único que puede hacer la persona, así que tiene que estar y
  // tiene que servir.
  it("el botón de reintentar vuelve a preguntar", async () => {
    traerHorarios.mockRejectedValueOnce(new Error("Se cayó la base")).mockResolvedValueOnce([]);

    render(<ProfessionalSchedule professional={professional} office={office} />);
    await waitFor(() => expect(screen.getByText(/no pudimos traer la agenda/i)).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /probar de nuevo/i }));

    await waitFor(() => expect(screen.getByText(/no tiene horarios libres/i)).toBeInTheDocument());
    expect(traerHorarios).toHaveBeenCalledTimes(2);
  });
});
