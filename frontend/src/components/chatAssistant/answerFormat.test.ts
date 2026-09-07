import { describe, expect, it } from "vitest";
import { hasStructure, readAnswer } from "./answerFormat";

describe("Lo que el asistente contesta", () => {
  it("deja el texto corto como está", () => {
    const blocks = readAnswer("No tenés turnos próximos. ¿Querés que te busque uno?");

    expect(hasStructure(blocks)).toBe(false);
    expect(blocks).toEqual([{ kind: "text", text: "No tenés turnos próximos. ¿Querés que te busque uno?" }]);
  });

  it("reconoce una lista de turnos con su número, su fecha y su estado", () => {
    const blocks = readAnswer(
      [
        "Estos son tus turnos:",
        "- Turno #12 · lunes 8 de septiembre de 09:00 a 10:00 · Juan Pérez · Confirmado",
        "- Turno #15 · martes 9 de septiembre de 11:00 a 12:00 · Ana López · Pendiente",
      ].join("\n")
    );

    expect(hasStructure(blocks)).toBe(true);
    expect(blocks[0]).toEqual({ kind: "text", text: "Estos son tus turnos:" });

    const lista = blocks[1];
    if (lista.kind !== "list") throw new Error("esperaba una lista");

    expect(lista.items[0]).toEqual({
      number: 12,
      title: "lunes 8 de septiembre de 09:00 a 10:00",
      meta: ["Juan Pérez"],
      state: { label: "Confirmado", tone: "green" },
    });
    expect(lista.items[1].state).toEqual({ label: "Pendiente", tone: "amber" });
  });

  it("no confunde con un estado lo último de un renglón que no lo es", () => {
    const blocks = readAnswer("- Turno #7 · viernes 12 · Sucursal Centro");
    const lista = blocks[0];
    if (lista.kind !== "list") throw new Error("esperaba una lista");

    expect(lista.items[0].state).toBeNull();
    expect(lista.items[0].meta).toEqual(["Sucursal Centro"]);
  });

  it("sirve para una lista sin números, como los horarios libres", () => {
    const blocks = readAnswer(["Te quedan libres:", "- 09:00 a 10:00", "- 15:00 a 16:00"].join("\n"));
    const lista = blocks[1];
    if (lista.kind !== "list") throw new Error("esperaba una lista");

    expect(lista.items.map((i) => i.title)).toEqual(["09:00 a 10:00", "15:00 a 16:00"]);
    expect(lista.items.every((i) => i.number === null && i.state === null)).toBe(true);
  });

  it("saca los asteriscos que al modelo se le escapan", () => {
    const blocks = readAnswer("**Tenés un turno mañana.**");

    expect(blocks).toEqual([{ kind: "text", text: "Tenés un turno mañana." }]);
  });

  it("separa dos listas que tienen un párrafo en el medio", () => {
    const blocks = readAnswer(["- uno", "Y aparte:", "- dos"].join("\n"));

    expect(blocks.map((b) => b.kind)).toEqual(["list", "text", "list"]);
  });
});

describe("Las formas que el modelo repite", () => {
  it("entiende el número pegado a la fecha con dos puntos y la raya como separador", () => {
    const blocks = readAnswer("- Turno #3527: 07/09/2026 de 16:00 a 17:00 – confirmado");
    const lista = blocks[0];
    if (lista.kind !== "list") throw new Error("esperaba una lista");

    expect(lista.items[0]).toEqual({
      number: 3527,
      title: "07/09/2026 de 16:00 a 17:00",
      meta: [],
      state: { label: "confirmado", tone: "green" },
    });
  });

  it("acepta el guion suelto como separador", () => {
    const blocks = readAnswer("- Turno #12 - lunes 8 - Juan Pérez - Pendiente");
    const lista = blocks[0];
    if (lista.kind !== "list") throw new Error("esperaba una lista");

    expect(lista.items[0].number).toBe(12);
    expect(lista.items[0].title).toBe("lunes 8");
    expect(lista.items[0].meta).toEqual(["Juan Pérez"]);
    expect(lista.items[0].state?.tone).toBe("amber");
  });

  /* Un guion sin espacios alrededor no separa nada: parte direcciones y horarios. */
  it("no parte un texto que trae un guion adentro", () => {
    const blocks = readAnswer("- 9 de Julio 3672 · 08:00-09:00");
    const lista = blocks[0];
    if (lista.kind !== "list") throw new Error("esperaba una lista");

    expect(lista.items[0].title).toBe("9 de Julio 3672");
    expect(lista.items[0].meta).toEqual(["08:00-09:00"]);
  });
});
