import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { UsersAdmin } from "./usersAdmin";
import { changePatientEmail, deletePerson, toggleState } from "./usersService";
import { deletionLabel } from "./accountDeletion";
import type { Person } from "../../types";

/**
 * El panel de usuarios tiene que mostrar a los administradores.
 *
 * No es una preferencia de diseño: si no se ven, no hay desde dónde volver a habilitar a
 * uno que el sistema de seguridad cerró, y la cuenta queda muerta hasta que alguien toque
 * la base a mano. Lo otro que se prueba acá es la vuelta de eso: la propia fila no ofrece
 * el botón de deshabilitar, porque el que queda afuera no puede pedir volver.
 *
 * Deshabilitar y eliminar se preguntan antes, porque las dos dejan a alguien afuera y la
 * segunda no se deshace. El aviso de deshabilitar tiene que decir qué día se borra.
 *
 * Y que deshabilitar se vea. La página y el servidor se publican por separado, así que
 * hay ratos en que la página nueva le habla a un servidor que todavía contesta como
 * antes, sin decir cómo quedó la cuenta. Ahí el cambio se hizo igual y la fila lo tiene
 * que mostrar igual.
 */

const persona = (email: string, type: string, extra: Partial<Person> = {}): Person => ({
  email,
  docType: "DNI",
  docNumber: "30000000",
  name: email.split("@")[0],
  surname: "Apellido",
  phoneNumber: "3410000000",
  speciality: "",
  type,
  active: true,
  ...extra,
});

const GENTE = [
  persona("admin@admin.com", "admin"),
  persona("otro@admin.com", "admin"),
  persona("kine@mail.com", "professional", { speciality: "Kinesiología" }),
  persona("paciente@mail.com", "client"),
  persona("sincuenta@mail.com", "client", { anonymous: true, createdBy: "kine@mail.com" }),
];

vi.mock("./usersService", () => ({
  getAllUsers: vi.fn(() => Promise.resolve(GENTE)),
  toggleState: vi.fn(() => Promise.resolve({ active: false, bookable: false, deletionAt: null })),
  toggleBookable: vi.fn(() => Promise.resolve({ bookable: false })),
  toggleWaitlist: vi.fn(() => Promise.resolve({ waitlistEnabled: false, message: "" })),
  deletePerson: vi.fn(() => Promise.resolve()),
  findBouncedEmails: vi.fn(() => Promise.resolve([])),
  changePatientEmail: vi.fn((_email: string, nuevo: string) => Promise.resolve({ ...GENTE[3], email: nuevo })),
  updatePerson: vi.fn(),
}));

vi.mock("../../analytics/behaviourService.ts", () => ({
  findBehaviourReport: vi.fn(() => Promise.resolve({ suspicious: [] })),
  explainSuspicion: () => "",
}));

vi.mock("../../commonServices.ts", () => ({
  getDecodedToken: () => ({ email: "admin@admin.com", type: "admin", exp: 0 }),
}));

vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual<typeof import("react-router-dom")>("react-router-dom")),
  useNavigate: () => vi.fn(),
}));

function abrirFicha(email: string) {
  return userEvent.click(screen.getByText(`Apellido, ${email.split("@")[0]}`));
}

describe("Panel de usuarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    render(
      <BrowserRouter>
        <UsersAdmin />
      </BrowserRouter>
    );
  });

  it("muestra a los administradores, con su cartelito y su contador", async () => {
    expect(await screen.findByText("Apellido, admin")).toBeInTheDocument();
    expect(screen.getByText("Apellido, otro")).toBeInTheDocument();
    expect(screen.getAllByText("Administración")).not.toHaveLength(0);

    const chip = screen.getByRole("button", { name: /^Administración/ });
    expect(within(chip).getByText("2")).toBeInTheDocument();
  });

  it("filtra solo administradores cuando se elige ese chip", async () => {
    await screen.findByText("Apellido, admin");
    await userEvent.click(screen.getByRole("button", { name: /^Administración/ }));

    expect(screen.getByText("Apellido, otro")).toBeInTheDocument();
    expect(screen.queryByText("Apellido, paciente")).not.toBeInTheDocument();
    expect(screen.queryByText("Apellido, kine")).not.toBeInTheDocument();
  });

  it("no ofrece deshabilitar la propia cuenta, y sí la de otro administrador", async () => {
    await screen.findByText("Apellido, admin");

    await abrirFicha("admin@admin.com");
    expect(screen.queryByRole("button", { name: "Deshabilitar" })).not.toBeInTheDocument();
    expect(screen.getByText(/Cuenta propia\. Solo otro administrador/)).toBeInTheDocument();

    // La ventana tiene dos: la cruz de arriba y el botón del pie. Va el del pie.
    const cerrar = screen.getAllByRole("button", { name: "Cerrar" });
    await userEvent.click(cerrar[cerrar.length - 1]);

    await abrirFicha("otro@admin.com");
    expect(screen.getByRole("button", { name: "Deshabilitar" })).toBeInTheDocument();
  });

  it("avisa qué día se borra la cuenta antes de deshabilitarla, y recién ahí la deshabilita", async () => {
    await screen.findByText("Apellido, kine");
    await abrirFicha("kine@mail.com");

    await userEvent.click(screen.getByRole("button", { name: "Deshabilitar" }));

    expect(screen.getByText(new RegExp(`La cuenta y sus turnos se eliminan a partir del ${deletionLabel()}`))).toBeInTheDocument();
    expect(toggleState).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Sí, deshabilitar" }));

    expect(toggleState).toHaveBeenCalledWith("kine@mail.com");
    expect((await screen.findAllByText("Deshabilitado")).length).toBeGreaterThan(0);
  });

  it("elimina un paciente después de preguntarlo, y lo saca de la lista", async () => {
    await screen.findByText("Apellido, paciente");
    await abrirFicha("paciente@mail.com");

    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(deletePerson).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Sí, eliminar" }));

    expect(deletePerson).toHaveBeenCalledWith("paciente@mail.com", false);
    await waitFor(() => expect(screen.queryByText("Apellido, paciente")).not.toBeInTheDocument());
  });

  // El correo es la clave del paciente en la base, así que corregirlo mueve la ficha
  // entera: la fila cambia de clave y se reemplaza con lo que devuelve el servidor.
  it("corrige el correo de un paciente sin cuenta y la fila pasa a la dirección nueva", async () => {
    await screen.findByText("Apellido, sincuenta");
    await abrirFicha("sincuenta@mail.com");

    await userEvent.click(screen.getByRole("button", { name: "Corregir el correo" }));
    await userEvent.clear(screen.getByRole("textbox"));
    await userEvent.type(screen.getByRole("textbox"), "bien@mail.com");
    await userEvent.click(screen.getByRole("button", { name: "Guardar el correo" }));

    expect(changePatientEmail).toHaveBeenCalledWith("sincuenta@mail.com", "bien@mail.com");
    expect(await screen.findByText("bien@mail.com")).toBeInTheDocument();
  });

  // Quien tiene cuenta propia entra con ese correo, así que desde acá no se toca.
  it("no ofrece corregir el correo de un paciente con cuenta", async () => {
    await screen.findByText("Apellido, paciente");
    await abrirFicha("paciente@mail.com");

    expect(screen.queryByRole("button", { name: "Corregir el correo" })).not.toBeInTheDocument();
  });

  it("no ofrece eliminar a un profesional", async () => {
    await screen.findByText("Apellido, kine");
    await abrirFicha("kine@mail.com");

    expect(screen.queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();
  });

  // El servidor viejo contesta que salió bien y nada más. Antes de esto, la página se
  // caía sola leyendo un dato que no venía y la fila quedaba como si no hubiera pasado.
  it("marca la fila igual si el servidor no cuenta como quedo", async () => {
    vi.mocked(toggleState).mockResolvedValueOnce(null);

    await screen.findByText("Apellido, kine");
    await abrirFicha("kine@mail.com");

    await userEvent.click(screen.getByRole("button", { name: "Deshabilitar" }));
    await userEvent.click(screen.getByRole("button", { name: "Sí, deshabilitar" }));

    expect((await screen.findAllByText("Deshabilitado")).length).toBeGreaterThan(0);
  });
});
