import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { resetInstallationForTests } from "../../../lib/installation.ts";
import type { City, Office, Person } from "../../types.ts";

const { sucursales, profesionalesDe } = vi.hoisted(() => ({
  sucursales: vi.fn(),
  profesionalesDe: vi.fn(),
}));

vi.mock("../../adminCRUDS/adminOffices/OfficeService.ts", () => ({ findAllActiveOffices: sucursales }));
vi.mock("../../adminCRUDS/adminUsers/usersService.ts", () => ({ findProfessionalsOfficeSpecialty: profesionalesDe }));
vi.mock("../../commonServices", () => ({
  getDecodedToken: () => ({ email: "marta@test.com", type: "client", exp: 0 }),
  findPerson: () => Promise.resolve(undefined),
}));
vi.mock("../appointmentsService.ts", () => ({
  getAvailableAppointmentsForPatient: vi.fn(() => Promise.resolve([])),
  createAppointment: vi.fn(),
}));

import { BookAppointment } from "./BookAppointment.tsx";

/**
 * El pedido de turno con varias sucursales.
 *
 * Con la regla apagada tiene que ser la pantalla de siempre: la primera sucursal, sin
 * elegir nada. Prendida, se elige la sucursal y cada profesional dice dónde atiende; y el
 * aviso de la lista de espera, que trae al profesional en la dirección, tiene que caer en
 * una sucursal donde ese profesional atiende, o el horario que se liberó no aparece.
 */

const ciudad = (nameCity: string) => ({ idCity: nameCity, nameCity }) as City;

const CENTRO: Office = { idOffice: "1", description: "Centro", openingTime: "08:00", closingTime: "20:00", city: ciudad("Rosario"), active: true };
const NORTE: Office = { idOffice: "2", description: "Norte", openingTime: "09:00", closingTime: "18:00", city: ciudad("Funes"), active: true };

const persona = (email: string, name: string, surname: string): Person =>
  ({ email, name, surname, speciality: "Psicología", type: "professional", active: true }) as Person;

const ANA = persona("ana@test.com", "Ana", "Ríos");
const BEA = persona("bea@test.com", "Bea", "Paz");

function dibujar(path = "/Appointment") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BookAppointment />
    </MemoryRouter>
  );
}

function prender() {
  resetInstallationForTests({
    policies: { multiBranch: true },
    branches: [
      { id: 1, name: "Centro", address: "Mitre 100", city: "Rosario", opens: "08:00", closes: "20:00" },
      { id: 2, name: "Norte", address: null, city: "Funes", opens: "09:00", closes: "18:00" },
    ],
  });
}

describe("El pedido de turno con varias sucursales", () => {
  beforeEach(() => {
    // jsdom no lo tiene, y la pantalla lleva los horarios a la vista al elegir.
    Element.prototype.scrollIntoView = vi.fn();
    sucursales.mockReset().mockResolvedValue([CENTRO, NORTE]);
    profesionalesDe.mockReset().mockImplementation((id: string) => Promise.resolve(id === "1" ? [ANA] : [ANA, BEA]));
  });

  afterEach(() => resetInstallationForTests());

  it("con la regla apagada, es la pantalla de siempre", async () => {
    resetInstallationForTests({ policies: { multiBranch: false } });
    dibujar();

    await waitFor(() => expect(screen.getByText("Ríos, Ana")).toBeInTheDocument());
    expect(screen.queryByRole("group", { name: "Sucursal" })).not.toBeInTheDocument();
    expect(profesionalesDe).toHaveBeenCalledTimes(1);
    expect(profesionalesDe).toHaveBeenCalledWith("1");
  });

  it("se elige la sucursal y cada profesional dice dónde atiende", async () => {
    prender();
    dibujar();

    const elegir = await screen.findByRole("group", { name: "Sucursal" });
    expect(within(elegir).getByRole("button", { name: /Centro/ })).toHaveAttribute("aria-pressed", "true");
    // Las dos quedan en ciudades distintas: el nombre solo no alcanza.
    expect(await screen.findByText("Centro (Rosario) · Norte (Funes)")).toBeInTheDocument();
    expect(screen.queryByText("Paz, Bea")).not.toBeInTheDocument();

    await userEvent.click(within(elegir).getByRole("button", { name: /Norte/ }));
    expect(await screen.findByText("Paz, Bea")).toBeInTheDocument();
  });

  it("el aviso de la lista de espera pasa a una sucursal donde atiende ese profesional", async () => {
    prender();
    dibujar("/Appointment?profesional=bea@test.com");

    const elegir = await screen.findByRole("group", { name: "Sucursal" });
    await waitFor(() => expect(within(elegir).getByRole("button", { name: /Norte/ })).toHaveAttribute("aria-pressed", "true"));
    expect(await screen.findByText(/Horarios de Paz, Bea/)).toBeInTheDocument();
  });

  it("respeta la sucursal que viene en la dirección", async () => {
    prender();
    dibujar("/Appointment?sucursal=2");

    const elegir = await screen.findByRole("group", { name: "Sucursal" });
    await waitFor(() => expect(within(elegir).getByRole("button", { name: /Norte/ })).toHaveAttribute("aria-pressed", "true"));
  });
});
