import { describe, expect, it } from "vitest";
import { DEFAULT_INSTALLATION, type Installation } from "../../../lib/installation.ts";
import { branchHours, branchName, branchPlace, findBranch, manyCities, officeIdOf } from "./branches.ts";

/**
 * Las sucursales llegan de tres formas según la ruta: la lista pública, la sucursal con
 * sesión y, en los turnos y los horarios, a veces solo el número o la fila cruda de la
 * base. Lo que se prueba es que las tres terminen diciendo lo mismo en pantalla.
 */

const INSTALACION: Installation = {
  ...DEFAULT_INSTALLATION,
  address: "Mitre 100",
  city: "Rosario",
  branches: [
    { id: 1, name: "Centro", address: "Mitre 100", city: "Rosario", opens: "08:00", closes: "20:00" },
    { id: 2, name: "Norte", address: null, city: "Funes", opens: "09:00", closes: "" },
  ],
};

describe("Las sucursales", () => {
  it("leen el número venga como venga", () => {
    expect(officeIdOf({ idOffice: 2 })).toBe("2");
    expect(officeIdOf({ id_office: 2, description: "Norte" })).toBe("2");
    expect(officeIdOf(2)).toBe("2");
    expect(officeIdOf(null)).toBeNull();
  });

  it("toman la ciudad de la lista aunque el turno la traiga como un número", () => {
    const delTurno = { idOffice: 2, description: "Norte", city: 7 };
    expect(findBranch(delTurno, INSTALACION)?.city).toBe("Funes");
  });

  it("sin calle cargada usan la dirección general, como los recordatorios", () => {
    expect(branchPlace(INSTALACION.branches[0], INSTALACION)).toBe("Mitre 100, Rosario");
    expect(branchPlace(INSTALACION.branches[1], INSTALACION)).toBe("Mitre 100, Rosario");
    expect(branchPlace(INSTALACION.branches[1], { ...INSTALACION, address: "", city: "" })).toBe("Funes");
  });

  it("llevan la ciudad en el nombre solo cuando hay más de una", () => {
    expect(manyCities(INSTALACION.branches)).toBe(true);
    expect(manyCities([{ city: "Rosario" }, { city: "rosario " }])).toBe(false);
    expect(branchName(INSTALACION.branches[1], true)).toBe("Norte (Funes)");
    expect(branchName(INSTALACION.branches[1], false)).toBe("Norte");
  });

  it("dicen el horario solo si están las dos horas", () => {
    expect(branchHours(INSTALACION.branches[0])).toBe("08:00 a 20:00");
    expect(branchHours(INSTALACION.branches[1])).toBe("");
  });
});
