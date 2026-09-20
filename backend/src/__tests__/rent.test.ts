import { describe, it, expect } from "vitest";
import AdmZip from "adm-zip";
import {
  blocksOf,
  compoundAdjust,
  computeCharge,
  dueDate,
  extraKey,
  freeBlocks,
  isLate,
  moduleOf,
  outsideParts,
  paymentStatus,
  shiftMonth,
  stretchesOf,
  usesOf,
  type RoomPrices,
  type ScheduleSlot,
} from "../rent/rent.rules.js";
import { buildXlsx } from "../shared/xlsx.js";

// Septiembre de 2026 tiene cuatro lunes y cinco martes, y los dos se cobran igual.
const SEPT = "2026-09";

const slot = (day: string, initialHour: string, finalHour: string, roomId = 1): ScheduleSlot => ({
  day,
  initialHour,
  finalHour,
  roomId,
  room: `Consultorio ${roomId}`,
});

describe("alquiler - bloques de un horario", () => {
  it("tocar un bloque alcanza para usarlo", () => {
    expect(blocksOf("09:00", "11:00")).toEqual(["morning"]);
    expect(blocksOf("12:00", "15:00")).toEqual(["morning", "afternoon"]);
    expect(blocksOf("19:30", "20:00")).toEqual(["afternoon"]);
  });

  it("de 13 a 14 no hay bloque", () => {
    expect(blocksOf("13:00", "14:00")).toEqual([]);
  });

  it("separa lo que cae fuera de los bloques", () => {
    expect(outsideParts("12:00", "15:00")).toEqual([{ from: "13:00", to: "14:00" }]);
    expect(outsideParts("08:00", "10:00")).toEqual([{ from: "08:00", to: "09:00" }]);
    expect(outsideParts("19:00", "21:00")).toEqual([{ from: "20:00", to: "21:00" }]);
    expect(outsideParts("09:00", "13:00")).toEqual([]);
  });
});

describe("alquiler - meses", () => {
  it("un mes con cinco semanas cuesta lo mismo que uno con cuatro", () => {
    const prices: RoomPrices = new Map([[1, { morning: 1000 }]]);
    const lunes = computeCharge([slot("lunes", "09:00", "13:00")], prices, new Map(), SEPT);
    const martes = computeCharge([slot("martes", "09:00", "13:00")], prices, new Map(), SEPT);

    expect(lunes.amount).toBe(1000);
    expect(martes.amount).toBe(1000);
  });

  it("pasa de año", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("alquiler - tramos de corrido", () => {
  it("los horarios pegados son un solo tramo", () => {
    expect(stretchesOf([slot("lunes", "09:00", "11:00"), slot("lunes", "11:00", "13:00")])).toEqual([
      { from: "09:00", to: "13:00", minutes: 240 },
    ]);
  });

  it("con un hueco en el medio son dos tramos", () => {
    expect(stretchesOf([slot("lunes", "09:00", "13:00"), slot("lunes", "14:00", "20:00")])).toEqual([
      { from: "09:00", to: "13:00", minutes: 240 },
      { from: "14:00", to: "20:00", minutes: 360 },
    ]);
  });

  it("el módulo sale de lo que dura", () => {
    expect(moduleOf(4 * 60)).toBe("morning");
    expect(moduleOf(6 * 60)).toBe("afternoon");
    expect(moduleOf(6 * 60 + 30)).toBe("day");
    expect(moduleOf(11 * 60)).toBe("day");
    expect(moduleOf(2 * 60)).toBeNull();
    expect(moduleOf(5 * 60)).toBeNull();
  });
});

describe("alquiler - la cuota por módulos", () => {
  const prices: RoomPrices = new Map([
    [1, { morning: 1000, afternoon: 1200, day: 2000 }],
    [2, { morning: 1500, afternoon: 2000 }],
  ]);

  it("cuatro horas son el módulo de la mañana aunque caigan a la tarde", () => {
    const manana = computeCharge([slot("lunes", "09:00", "13:00")], prices, new Map(), SEPT);
    const tarde = computeCharge([slot("lunes", "14:00", "18:00")], prices, new Map(), SEPT);

    expect(manana.amount).toBe(1000);
    expect(tarde.amount).toBe(1000);
    expect(tarde.blocks[0].block).toBe("morning");
    // El horario real queda en la línea: así se ve que cayó a la tarde.
    expect(tarde.blocks[0].from).toBe("14:00");
    expect(tarde.blocks[0].to).toBe("18:00");
  });

  it("seis horas son el módulo de la tarde aunque caigan a la mañana", () => {
    const charge = computeCharge([slot("lunes", "08:00", "14:00")], prices, new Map(), SEPT);

    expect(charge.blocks[0].block).toBe("afternoon");
    expect(charge.amount).toBe(1200);
    expect(charge.outside).toEqual([]);
  });

  it("más de seis horas son el día entero", () => {
    const charge = computeCharge([slot("lunes", "09:00", "20:00")], prices, new Map(), SEPT);

    expect(charge.blocks).toEqual([]);
    expect(charge.outside).toEqual([]);
    expect(charge.days).toHaveLength(1);
    expect(charge.amount).toBe(2000);
    expect(charge.missing).toEqual([]);
  });

  it("los horarios pegados se suman y arman un módulo", () => {
    const charge = computeCharge([slot("lunes", "09:00", "11:00"), slot("lunes", "11:00", "13:00")], prices, new Map(), SEPT);

    expect(charge.blocks).toHaveLength(1);
    expect(charge.amount).toBe(1000);
    expect(charge.missing).toEqual([]);
  });

  it("con un corte en el medio cada tramo paga lo suyo", () => {
    const charge = computeCharge([slot("lunes", "09:00", "13:00"), slot("lunes", "14:00", "20:00")], prices, new Map(), SEPT);

    expect(charge.days).toEqual([]);
    expect(charge.amount).toBe(1000 + 1200);
  });

  it("un tramo de otra duración va a valor a mano", () => {
    const charge = computeCharge([slot("lunes", "09:00", "11:00")], prices, new Map(), SEPT);

    expect(charge.blocks).toEqual([]);
    expect(charge.amount).toBe(0);
    expect(charge.outside).toHaveLength(1);
    expect(charge.missing).toEqual(["Falta el valor del lunes de 09:00 a 11:00"]);
  });

  it("con el valor a mano, el tramo se cobra una vez por mes", () => {
    const extras = new Map([[extraKey("lunes", "09:00"), 300]]);
    const charge = computeCharge([slot("lunes", "09:00", "11:00")], prices, extras, SEPT);

    expect(charge.amount).toBe(300);
    expect(charge.missing).toEqual([]);
  });

  it("un módulo sin precio no suma y queda anotado", () => {
    const charge = computeCharge([slot("lunes", "09:00", "13:00", 3)], prices, new Map(), SEPT);

    expect(charge.amount).toBe(0);
    expect(charge.missing).toEqual(["Falta el precio de la mañana de Consultorio 3"]);
  });

  it("sin precio del día, el día entero queda anotado", () => {
    const charge = computeCharge([slot("lunes", "09:00", "20:00", 2)], prices, new Map(), SEPT);

    expect(charge.days).toHaveLength(1);
    expect(charge.amount).toBe(0);
    expect(charge.missing).toEqual(["Falta el precio del día de Consultorio 2"]);
  });

  it("el ajuste propio sube la cuota entera", () => {
    const charge = computeCharge([slot("lunes", "09:00", "13:00")], prices, new Map(), SEPT, 1000);
    expect(charge.amount).toBe(1100);
  });

  it("dos aumentos del diez son un veintiuno", () => {
    expect(compoundAdjust(1000, 10)).toBe(2100);
  });

  it("cada día va por su lado y por consultorio", () => {
    const charge = computeCharge(
      [slot("lunes", "09:00", "20:00"), slot("martes", "09:00", "13:00"), slot("lunes", "09:00", "13:00", 2)],
      prices,
      new Map(),
      SEPT
    );

    expect(charge.days.map((line) => `${line.roomId}|${line.day}`)).toEqual(["1|lunes"]);
    expect(charge.amount).toBe(2000 + 1000 + 1500);
    expect(usesOf(charge)).toBe(2 + 1 + 1); // el día cuenta como sus dos franjas
  });
});

describe("alquiler - bloques libres", () => {
  it("un bloque con un horario adentro ya no está libre", () => {
    const prices: RoomPrices = new Map([[1, { morning: 1000, afternoon: 1200 }]]);
    const [room] = freeBlocks([{ roomId: 1, room: "Consultorio 1", office: "Central" }], [slot("lunes", "10:00", "11:00")], prices, SEPT);

    expect(room.occupied).toBe(1);
    expect(room.free).toHaveLength(9); // cinco días por dos bloques, menos el lunes a la mañana
    expect(room.free.some((block) => block.day === "lunes" && block.block === "morning")).toBe(false);
    // La tarde del lunes vale $1200 por mes.
    expect(room.free.find((block) => block.day === "lunes" && block.block === "afternoon")?.subtotal).toBe(1200);
  });
});

describe("alquiler - pagos", () => {
  const due = dueDate(SEPT, 10);

  it("el vencimiento es el día configurado del mismo mes", () => {
    expect(due).toBe("2026-09-10");
    expect(dueDate(SEPT, 31)).toBe("2026-09-28");
  });

  it("el estado sale de lo pagado contra la cuota", () => {
    expect(paymentStatus(10000, 10000)).toBe("paid");
    expect(paymentStatus(10000, 4000)).toBe("partial");
    expect(paymentStatus(10000, 0)).toBe("unpaid");
    expect(paymentStatus(null, 0)).toBe("none");
  });

  it("pagar después del vencimiento es pagar tarde", () => {
    expect(isLate(10000, 10000, "2026-09-11", due, "2026-09-20")).toBe(true);
    expect(isLate(10000, 10000, "2026-09-10", due, "2026-09-20")).toBe(false);
  });

  it("deber pasado el vencimiento ya cuenta como tarde", () => {
    expect(isLate(10000, 0, null, due, "2026-09-11")).toBe(true);
    expect(isLate(10000, 3000, "2026-09-05", due, "2026-09-11")).toBe(true);
    expect(isLate(10000, 0, null, due, "2026-09-09")).toBe(false);
  });
});

describe("planilla de Excel", () => {
  it("arma un xlsx con las hojas y escapa el texto", () => {
    const buffer = buildXlsx([
      { name: "Cuotas septiembre 2026", columns: [{ header: "Profesional" }, { header: "Cuota", money: true }], rows: [["Pérez & Hijos", 15000]] },
    ]);

    const zip = new AdmZip(buffer);
    const names = zip.getEntries().map((entry) => entry.entryName);

    expect(names).toContain("xl/workbook.xml");
    expect(names).toContain("xl/worksheets/sheet1.xml");

    const sheet = zip.readAsText("xl/worksheets/sheet1.xml");
    expect(sheet).toContain("Pérez &amp; Hijos");
    expect(sheet).toContain('<c r="B2" s="2"><v>15000</v></c>');
  });
});
