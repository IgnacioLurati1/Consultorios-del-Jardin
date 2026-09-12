import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("axios", () => ({
  default: { get, post, create: () => ({ interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } } }) },
}));

import { AttendancePage } from "./AttendancePage.tsx";

const turno = {
  numAppointment: 812,
  date: "2026-09-11",
  initialHour: "11:00",
  finalHour: "12:00",
  professional: { name: "Ana", surname: "Ríos", speciality: "Psicología" },
  room: "Consultorio 2",
  status: "accepted",
  confirmedAt: null,
};

function abrir(query: string) {
  return render(
    <MemoryRouter initialEntries={[`/asistencia?${query}`]}>
      <AttendancePage />
    </MemoryRouter>
  );
}

/**
 * Los links del mail del día anterior.
 *
 * Lo que importa probar es lo que no se ve: que abrir el link no contesta nada. Los
 * programas de correo abren los links solos, y un "No puedo ir" que cancelara al abrirse
 * dejaría sin turno a gente que nunca lo canceló.
 */
describe("La página de los links de asistencia", () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue({ data: { data: turno } });
    post.mockReset();
  });

  it("abrir el link de 'No puedo ir' no cancela: pide confirmarlo", async () => {
    abrir("t=firma&r=no");

    await waitFor(() => expect(screen.getByText(/al cancelar/i)).toBeInTheDocument());
    expect(post).not.toHaveBeenCalled();

    post.mockResolvedValue({ data: { data: { ...turno, status: "cancelled" } } });
    await userEvent.click(screen.getByRole("button", { name: "Cancelar turno" }));

    expect(post).toHaveBeenCalledWith(expect.stringContaining("/attendance/firma"), { answer: "no" });
    await waitFor(() => expect(screen.getByText("Turno cancelado")).toBeInTheDocument());
  });

  it("'Sí, voy' se contesta con un toque y lo confirma", async () => {
    abrir("t=firma&r=si");

    await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar asistencia" })).toBeInTheDocument());
    expect(post).not.toHaveBeenCalled();

    post.mockResolvedValue({ data: { data: { ...turno, confirmedAt: "2026-09-10T12:00:00Z" } } });
    await userEvent.click(screen.getByRole("button", { name: "Confirmar asistencia" }));

    expect(post).toHaveBeenCalledWith(expect.stringContaining("/attendance/firma"), { answer: "yes" });
    await waitFor(() => expect(screen.getByText("Asistencia confirmada")).toBeInTheDocument());
  });

  it("un link sin firma lo dice en vez de quedarse cargando", () => {
    abrir("r=si");
    expect(screen.getByText("Link incompleto")).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });
});
