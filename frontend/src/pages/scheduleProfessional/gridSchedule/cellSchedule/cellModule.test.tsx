import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CellModule } from "./cellModule";
import type { Person, Room, Schedule } from "../../../types";

/**
 * La grilla de un profesional deshabilitado.
 *
 * Deshabilitar a alguien no le borra los horarios, y esos horarios siguen reservando el
 * consultorio: si desde su grilla no se pudieran sacar, quedarían ocupando salas para
 * siempre. Así que la franja cargada tiene que seguir abriéndose, que es por donde se
 * borra, y el hueco libre no, porque cargarle atención a quien ya no atiende es publicar
 * un horario que nadie va a cubrir.
 */

const PROFESIONAL = {
  email: "kine@mail.com",
  docType: "DNI",
  docNumber: "30000000",
  name: "Ana",
  surname: "Suárez",
  phoneNumber: "3410000000",
  speciality: "Kinesiología",
  type: "professional",
  active: false,
} as Person;

const SALA = { idRoom: "1", description: "Sala Verde", active: true } as Room;

const MODULO: Schedule = {
  day: "lunes",
  initialHour: "09:00",
  finalHour: "12:00",
  person: PROFESIONAL,
  room: SALA,
  active: true,
  duration: 30,
};

const abrirModal = vi.fn();
const elegirHorario = vi.fn();
const elegirCelda = vi.fn();

function pintar(props: { schedule?: Schedule; canCreate?: boolean; readOnly?: boolean }) {
  return render(
    <CellModule
      cellKey="lunes-09:00"
      height={1}
      setScheduleModalOpen={abrirModal}
      setSelectedSchedule={elegirHorario}
      setSelectedKey={elegirCelda}
      {...props}
    />
  );
}

describe("Celda de la grilla de horarios", () => {
  beforeEach(() => vi.clearAllMocks());

  it("abre la franja cargada aunque no se puedan crear horarios", async () => {
    pintar({ schedule: MODULO, canCreate: false });

    await userEvent.click(screen.getByText("09:00 - 12:00"));

    expect(abrirModal).toHaveBeenCalledWith(true);
    expect(elegirHorario).toHaveBeenCalledWith(MODULO);
  });

  it("no abre el hueco libre cuando no se puede crear", async () => {
    const { container } = pintar({ canCreate: false });

    await userEvent.click(container.querySelector(".hourly-module.empty")!);

    expect(abrirModal).not.toHaveBeenCalled();
  });

  it("el hueco libre abre el alta cuando sí se puede crear", async () => {
    const { container } = pintar({ canCreate: true });

    await userEvent.click(container.querySelector(".hourly-module.empty")!);

    expect(abrirModal).toHaveBeenCalledWith(true);
    expect(elegirHorario).toHaveBeenCalledWith(undefined);
  });

  // Modo consultorio: ahí no hay un profesional al que asignarle nada, así que no se
  // toca ninguna de las dos.
  it("en solo lectura no abre ni la franja cargada", async () => {
    pintar({ schedule: MODULO, readOnly: true });

    await userEvent.click(screen.getByText("09:00 - 12:00"));

    expect(abrirModal).not.toHaveBeenCalled();
  });
});
