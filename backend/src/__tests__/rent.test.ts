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
  outsideParts,
  paymentStatus,
  shiftMonth,
  weekdayCount,
  type RoomPrices,
  type ScheduleSlot,
} from "../rent/rent.rules.js";
import { buildXlsx } from "../shared/xlsx.js";

// Septiembre de 2026 empieza un martes: tiene cuatro lunes y cinco martes.
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
  it("cuenta los días reales de cada mes", () => {
    expect(weekdayCount(SEPT, "lunes")).toBe(4);
    expect(weekdayCount(SEPT, "martes")).toBe(5);
    expect(weekdayCount(SEPT, "miercoles")).toBe(5);
    expect(weekdayCount("2026-02", "lunes")).toBe(4);
  });

  it("pasa de año", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("alquiler - la cuota por bloques", () => {
  const prices: RoomPrices = new Map([
    [1, { morning: 1000, afternoon: 1200 }],
    [2, { morning: 1500, afternoon: 2000 }],
  ]);

  it("cobra cada bloque entero, una vez por día aunque haya dos horarios adentro", () => {
    const charge = computeCharge([slot("lunes", "09:00", "10:00"), slot("lunes", "11:00", "12:00")], prices, new Map(), SEPT);

    expect(charge.blocks).toHaveLength(1);
    expect(charge.amount).toBe(4000); // cuatro lunes de mañana a $1000
    expect(charge.missing).toEqual([]);
  });

  it("lo que cae de 13 a 14 queda sin cobrar y avisa que falta el valor", () => {
    const charge = computeCharge([slot("martes", "12:00", "15:00", 2)], prices, new Map(), SEPT);

    // Cinco martes: mañana a $1500 y tarde a $2000.
    expect(charge.amount).toBe(17500);
    expect(charge.outside).toHaveLength(1);
    expect(charge.missing).toEqual(["Falta el valor del martes de 13:00 a 14:00"]);
  });

  it("con el valor a mano, la franja se cobra cada vez", () => {
    const extras = new Map([[extraKey("martes", "12:00"), 300]]);
    const charge = computeCharge([slot("martes", "12:00", "15:00", 2)], prices, extras, SEPT);

    expect(charge.amount).toBe(17500 + 5 * 300);
    expect(charge.missing).toEqual([]);
  });

  it("el ajuste propio sube la cuota entera", () => {
    const charge = computeCharge([slot("lunes", "09:00", "10:00")], prices, new Map(), SEPT, 1000);
    expect(charge.amount).toBe(4400);
  });

  it("un bloque sin precio no suma y queda anotado", () => {
    const charge = computeCharge([slot("lunes", "09:00", "10:00", 3)], prices, new Map(), SEPT);

    expect(charge.amount).toBe(0);
    expect(charge.missing).toEqual(["Falta el precio de la mañana de Consultorio 3"]);
  });

  it("dos aumentos del diez son un veintiuno", () => {
    expect(compoundAdjust(1000, 10)).toBe(2100);
  });
});

describe("alquiler - bloques libres", () => {
  it("un bloque con un horario adentro ya no está libre", () => {
    const prices: RoomPrices = new Map([[1, { morning: 1000, afternoon: 1200 }]]);
    const [room] = freeBlocks([{ roomId: 1, room: "Consultorio 1", office: "Central" }], [slot("lunes", "10:00", "11:00")], prices, SEPT);

    expect(room.occupied).toBe(1);
    expect(room.free).toHaveLength(9); // cinco días por dos bloques, menos el lunes a la mañana
    expect(room.free.some((block) => block.day === "lunes" && block.block === "morning")).toBe(false);
    // La tarde del lunes vale 4 veces $1200.
    expect(room.free.find((block) => block.day === "lunes" && block.block === "afternoon")?.subtotal).toBe(4800);
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
