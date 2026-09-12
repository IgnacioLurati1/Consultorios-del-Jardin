import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CancelAppointmentModal } from "./CancelAppointmentModal.tsx";
import type { Appointment } from "../types.ts";

const turno = {
  numAppointment: 700,
  date: "2026-09-15",
  initialHour: "11:00:00",
  finalHour: "12:00:00",
  state: "accepted",
  patient: { email: "p@test.com", name: "Marta", surname: "Gómez" },
} as unknown as Appointment;

/**
 * Cancelar con gente esperando ese horario.
 *
 * El profesional puede estar cancelando porque ese día no va a estar, y ahí avisarles es
 * mandarlos a una puerta cerrada. Por eso, con alguien en la lista, la ventana pregunta, y
 * lo que se elige es lo que viaja.
 */
describe("La ventana de cancelar un turno", () => {
  it("sin nadie esperando, es la de siempre y no avisa a nadie", async () => {
    const onConfirm = vi.fn();
    render(<CancelAppointmentModal appointment={turno} onClose={vi.fn()} onConfirm={onConfirm} />);

    expect(screen.queryByText(/lista de espera/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sí, cancelarlo" }));

    expect(onConfirm).toHaveBeenCalledWith(turno, false);
  });

  it("con gente esperando, deja elegir si se les avisa", async () => {
    const onConfirm = vi.fn();
    render(<CancelAppointmentModal appointment={turno} waitlistCount={2} onClose={vi.fn()} onConfirm={onConfirm} />);

    expect(screen.getByText(/2 personas en la lista de espera/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cancelar y avisarles" }));
    expect(onConfirm).toHaveBeenLastCalledWith(turno, true);

    await userEvent.click(screen.getByRole("button", { name: "Cancelar sin avisar" }));
    expect(onConfirm).toHaveBeenLastCalledWith(turno, false);
  });
});
