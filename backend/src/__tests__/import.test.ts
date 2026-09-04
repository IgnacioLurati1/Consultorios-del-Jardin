import { describe, it, expect, vi } from "vitest";

// El servicio de importación importa el orm para buscar horarios y turnos. Acá no se
// prueba nada de eso —solo la lectura del archivo y la del precio, que son funciones
// puras— así que el orm se reemplaza antes de que intente conectarse a MySQL.
vi.mock("../shared/db/orm.js", () => ({
  orm: { em: { fork: vi.fn(), getConnection: vi.fn() } },
  syncSchema: vi.fn(),
}));

const { parseCalendars } = await import("../calendar/calendar.parser.js");
const { readValue } = await import("../calendar/import.service.js");

/** Un .ics como los que exporta Google, con el bloque de zona horaria adelante. */
function calendar(...events: string[]): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Google Inc//Google Calendar 70.9054//EN",
    "BEGIN:VTIMEZONE",
    "TZID:America/Argentina/Buenos_Aires",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:-0300",
    "TZOFFSETTO:-0300",
    "TZNAME:-03",
    "DTSTART:19700101T000000",
    "END:STANDARD",
    "END:VTIMEZONE",
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

function event(lines: string[]): string {
  return ["BEGIN:VEVENT", "DTSTAMP:20260701T120000Z", ...lines, "END:VEVENT"].join("\r\n");
}

const HASTA = new Date("2027-01-01T00:00:00Z");

describe("leer un calendario exportado", () => {
  it("saca el día y la hora del consultorio de un evento con zona declarada", () => {
    const { events } = parseCalendars(
      calendar(
        event([
          "UID:uno@test",
          "DTSTART;TZID=America/Argentina/Buenos_Aires:20260803T140000",
          "DTEND;TZID=America/Argentina/Buenos_Aires:20260803T150000",
          "SUMMARY:Sesión",
        ])
      ),
      HASTA
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ date: "2026-08-03", initialHour: "14:00", finalHour: "15:00", allDay: false });
  });

  it("convierte a la hora del consultorio lo que viene escrito en UTC", () => {
    const { events } = parseCalendars(
      calendar(event(["UID:utc@test", "DTSTART:20260902T130000Z", "DTEND:20260902T133000Z", "SUMMARY:En UTC"])),
      HASTA
    );

    // 13:00 UTC son las 10:00 en Buenos Aires. Sin esto, un calendario exportado desde
    // otra máquina cargaría todos los turnos corridos tres horas.
    expect(events[0]).toMatchObject({ date: "2026-09-02", initialHour: "10:00", finalHour: "10:30" });
  });

  it("despliega un evento semanal en una fecha por semana", () => {
    const { events } = parseCalendars(
      calendar(
        event([
          "UID:semanal@test",
          "DTSTART;TZID=America/Argentina/Buenos_Aires:20260803T140000",
          "DTEND;TZID=America/Argentina/Buenos_Aires:20260803T150000",
          "RRULE:FREQ=WEEKLY;COUNT=4;BYDAY=MO",
          "SUMMARY:Todos los lunes",
        ])
      ),
      HASTA
    );

    expect(events.map((item) => item.date)).toEqual(["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24"]);
  });

  it("corta la repetición en la fecha hasta la que se pidió importar", () => {
    // Sin fecha de fin. Es el caso que, sin tope, no termina nunca.
    const { events } = parseCalendars(
      calendar(
        event([
          "UID:infinito@test",
          "DTSTART;TZID=America/Argentina/Buenos_Aires:20260803T140000",
          "DTEND;TZID=America/Argentina/Buenos_Aires:20260803T150000",
          "RRULE:FREQ=WEEKLY;BYDAY=MO",
          "SUMMARY:Para siempre",
        ])
      ),
      new Date("2026-08-31T23:59:59-03:00")
    );

    expect(events.map((item) => item.date)).toEqual(["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31"]);
  });

  it("respeta la semana que se movió dentro de un evento repetido", () => {
    const { events } = parseCalendars(
      calendar(
        event([
          "UID:semanal@test",
          "DTSTART;TZID=America/Argentina/Buenos_Aires:20260803T140000",
          "DTEND;TZID=America/Argentina/Buenos_Aires:20260803T150000",
          "RRULE:FREQ=WEEKLY;COUNT=3;BYDAY=MO",
          "SUMMARY:Sesión",
        ]),
        event([
          "UID:semanal@test",
          "RECURRENCE-ID;TZID=America/Argentina/Buenos_Aires:20260810T140000",
          "DTSTART;TZID=America/Argentina/Buenos_Aires:20260810T160000",
          "DTEND;TZID=America/Argentina/Buenos_Aires:20260810T170000",
          "SUMMARY:Sesión movida",
        ])
      ),
      HASTA
    );

    const movida = events.find((item) => item.date === "2026-08-10");
    expect(movida?.initialHour).toBe("16:00");
    expect(movida?.summary).toBe("Sesión movida");
  });

  it("marca los que no pueden ser un turno en vez de descartarlos en silencio", () => {
    const { events } = parseCalendars(
      calendar(
        event(["UID:dia@test", "DTSTART;VALUE=DATE:20260814", "DTEND;VALUE=DATE:20260815", "SUMMARY:Feriado"]),
        event([
          "UID:noche@test",
          "DTSTART;TZID=America/Argentina/Buenos_Aires:20260805T230000",
          "DTEND;TZID=America/Argentina/Buenos_Aires:20260806T010000",
          "SUMMARY:Cruza la medianoche",
        ]),
        event([
          "UID:cancelado@test",
          "DTSTART;TZID=America/Argentina/Buenos_Aires:20260807T083000",
          "DTEND;TZID=America/Argentina/Buenos_Aires:20260807T090000",
          "SUMMARY:Se cayó",
          "STATUS:CANCELLED",
        ])
      ),
      HASTA
    );

    expect(events.find((item) => item.uid === "dia@test")?.allDay).toBe(true);
    expect(events.find((item) => item.uid === "noche@test")?.overnight).toBe(true);
    expect(events.find((item) => item.uid === "cancelado@test")?.cancelled).toBe(true);
  });

  it("junta las líneas plegadas a los 75 caracteres", () => {
    const plegado = [
      "BEGIN:VEVENT",
      "DTSTAMP:20260701T120000Z",
      "UID:largo@test",
      "DTSTART;TZID=America/Argentina/Buenos_Aires:20260803T140000",
      "DTEND;TZID=America/Argentina/Buenos_Aires:20260803T150000",
      "SUMMARY:Un titulo muy largo que el formato parte en dos lineas porque no",
      "  entra en una sola",
      "END:VEVENT",
    ].join("\r\n");

    const { events } = parseCalendars(calendar(plegado), HASTA);
    expect(events[0].summary).toBe("Un titulo muy largo que el formato parte en dos lineas porque no entra en una sola");
  });

  it("no se traga un archivo que no es un calendario", () => {
    expect(() => parseCalendars("esto no es un calendario", HASTA)).toThrow(/No pudimos leer/);
  });
});

describe("sacar el valor del turno del texto del evento", () => {
  it("lee un monto con signo de peso", () => {
    expect(readValue("Sesión Marta $6000")).toBe(6000);
    expect(readValue("Sesión $ 6000")).toBe(6000);
  });

  it("entiende el punto de los miles y la coma de los centavos", () => {
    expect(readValue("Cobré $12.000")).toBe(12000);
    expect(readValue("Cobré $12.500,50")).toBe(12501);
  });

  it("acepta un número suelto si es de tres cifras o más", () => {
    expect(readValue("Consulta 8000 efectivo")).toBe(8000);
  });

  it("no confunde con plata lo que no lo es", () => {
    // Los tres casos que aparecen de verdad en un calendario: el número de sesión, la
    // hora, y el teléfono del paciente.
    expect(readValue("Sesión 2")).toBeNull();
    expect(readValue("Control a las 14:30")).toBeNull();
    expect(readValue("Llamar al 3415551234")).toBeNull();
    expect(readValue("Turno del 12/05/2026")).toBeNull();
  });

  it("devuelve null y no cero cuando no hay ningún número", () => {
    // Cero diría que se atendió gratis, que es un dato; null dice que no se sabe.
    expect(readValue("Primera consulta")).toBeNull();
    expect(readValue("")).toBeNull();
  });

  it("prefiere el monto con signo aunque haya otros números antes", () => {
    expect(readValue("Sesión 2 de Marta, $5000")).toBe(5000);
  });
});
