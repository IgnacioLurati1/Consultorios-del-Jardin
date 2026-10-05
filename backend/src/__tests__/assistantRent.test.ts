import { describe, it, expect } from "vitest";
import { buildAssistantPrompt } from "../assistant/assistant.prompt.js";
import { toolsFor } from "../assistant/assistant.tools.js";

// ============================================================
// El asistente y los alquileres.
//
// No sabía que existían: a "¿quién debe alquiler?" contestaba que de eso no sabía, o lo
// mezclaba con lo cobrado por turnos. Son cosas del admin, igual que la pantalla, y al
// profesional solo se le indica que eso lo ve la administración.
// ============================================================

const RENT_TOOLS = ["get_rent_month", "get_rent_detail", "get_room_prices", "register_rent_payment"];
const names = (role: "client" | "professional" | "admin", pending = false) =>
  toolsFor(role, pending).map((tool) => tool.function!.name);
const prompt = (role: "client" | "professional" | "admin") => buildAssistantPrompt(role, "Ana", [], "lunes 5/10/2026");

describe("alquileres en el asistente", () => {
  it("el admin tiene las herramientas y la guía", () => {
    expect(names("admin")).toEqual(expect.arrayContaining(RENT_TOOLS));
    expect(prompt("admin")).toContain("ALQUILERES");
    expect(prompt("admin")).toContain("Hablás de turnos, profesionales, alquileres,");
  });

  it("el profesional y el paciente no las tienen, ni la guía", () => {
    for (const role of ["client", "professional"] as const) {
      expect(names(role).filter((name) => RENT_TOOLS.includes(name))).toEqual([]);
      expect(prompt(role)).not.toContain("ALQUILERES");
    }
  });

  it("al profesional que pregunta por su cuota lo manda a la administración", () => {
    expect(prompt("professional")).toContain("eso lo ve la administración");
  });

  it("registrar un pago pide confirmación, y el admin puede confirmar", () => {
    expect(names("admin")).not.toContain("confirm_action");
    expect(names("admin", true)).toContain("confirm_action");
  });

  it("ninguna herramienta de alquiler le pide el mail al modelo", () => {
    const rent = toolsFor("admin").filter((tool) => RENT_TOOLS.includes(tool.function!.name));
    expect(rent).toHaveLength(RENT_TOOLS.length);
    for (const tool of rent) {
      expect(Object.keys((tool.function!.parameters as any).properties)).not.toContain("professionalEmail");
    }
  });
});
