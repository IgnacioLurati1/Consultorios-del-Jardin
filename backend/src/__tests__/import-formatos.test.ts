import { describe, it, expect, vi } from "vitest";

/**
 * Las mil formas de escribir lo mismo.
 *
 * Un importador se rompe siempre por el mismo lado: no por el caso que uno imaginó, sino
 * por cómo escribe de verdad la persona que venía usando el calendario a su manera, y por
 * cómo exporta el programa del que sale el archivo. Los dos bloques de acá abajo son eso:
 * arriba las maneras de anotar un precio, abajo las maneras de escribir un .ics.
 */

vi.mock("../shared/db/orm.js", () => ({
  orm: { em: { fork: vi.fn(), getConnection: vi.fn() } },
  syncSchema: vi.fn(),
}));

const { parseCalendars } = await import("../calendar/calendar.parser.js");
const { readValue } = await import("../calendar/import.service.js");

const HASTA = new Date("2027-01-01T00:00:00Z");

describe("cómo anota la gente el precio", () => {
  it("con el signo adelante, como sea que lo separe", () => {
    for (const [texto, esperado] of [
      ["Sesión $6000", 6000],
      ["Sesión $ 6000", 6000],
      ["Sesión $6.000", 6000],
      ["Sesión $6,000", 6000], // separador de miles a la inglesa
      ["Sesión $6.000,50", 6001],
      ["Sesión $6,000.50", 6001],
      ["Sesión $6000.-", 6000],
      ["Sesión AR$ 6000", 6000],
      ["Sesión ARS 6000", 6000],
      ["Sesión U$S 60", 60],
    ] as const) {
      expect([texto, readValue(texto)]).toEqual([texto, esperado]);
    }
  });

  it("con el signo o la palabra atrás", () => {
    expect(readValue("Marta 6000$")).toBe(6000);
    expect(readValue("Marta 6000 pesos")).toBe(6000);
    expect(readValue("Marta 6.000 ARS")).toBe(6000);
  });

  it("escrito rápido, en miles", () => {
    expect(readValue("Sesión 8 mil")).toBe(8000);
    expect(readValue("Sesión 8mil")).toBe(8000);
    expect(readValue("Sesión 15k")).toBe(15000);
    expect(readValue("Sesión 15 K")).toBe(15000);
  });

  it("sin ningún símbolo, si el número tiene tamaño de precio", () => {
    expect(readValue("Juan 12000")).toBe(12000);
    expect(readValue("Juan 12.000")).toBe(12000);
    expect(readValue("cobré 8500 en efectivo")).toBe(8500);
  });

  it("y sobre todo, lo que no es un precio aunque sea un número", () => {
    // Todos estos aparecen en el título de un turno de verdad, y ninguno es plata.
    expect(readValue("Sesión 2")).toBeNull();
    expect(readValue("Sesión 3 de 12")).toBeNull();
    expect(readValue("Sala 101")).toBeNull();
    expect(readValue("Consultorio 202")).toBeNull();
    expect(readValue("Control a las 14:30")).toBeNull();
    expect(readValue("Turno 12/05/2026")).toBeNull();
    expect(readValue("Turno del 30/06")).toBeNull();
    expect(readValue("Llamar al 3415551234")).toBeNull(); // teléfono
    expect(readValue("DNI 30123456")).toBeNull(); // documento
    expect(readValue("Revisión 2026")).toBeNull(); // año
    expect(readValue("Obra social 4587")).toBe(4587); // este sí entra: no hay forma de saberlo
  });

  it("el signo le gana a cualquier otro número del texto", () => {
    expect(readValue("Sesión 2 de Marta, $5000")).toBe(5000);
    expect(readValue("Turno 12/05 a las 14:30 — $7500")).toBe(7500);
  });

  it("busca también en la descripción, no sólo en el título", () => {
    expect(readValue("Sesión Marta Cobré 12.000 en efectivo")).toBe(12000);
  });

  it("sin nada que parezca plata, no inventa un cero", () => {
    expect(readValue("Primera consulta")).toBeNull();
    expect(readValue("")).toBeNull();
    expect(readValue("   ")).toBeNull();
  });
});

/** Un .ics armado a mano, para poder torcerle cada detalle. */
function calendar(cuerpo: string[], opciones: { timezone?: boolean; salto?: string } = {}): string {
  const zona = opciones.timezone === false
    ? []
    : [
        "BEGIN:VTIMEZONE",
        "TZID:America/Argentina/Buenos_Aires",
        "BEGIN:STANDARD",
        "TZOFFSETFROM:-0300",
        "TZOFFSETTO:-0300",
        "TZNAME:-03",
        "DTSTART:19700101T000000",
        "END:STANDARD",
        "END:VTIMEZONE",
      ];

  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//prueba//EN", ...zona, ...cuerpo, "END:VCALENDAR", ""].join(
    opciones.salto ?? "\r\n"
  );
}

describe("cómo escribe el archivo cada programa", () => {
  it("con la duración en vez de la hora de fin, como exporta Outlook", () => {
    const { events } = parseCalendars(
      calendar([
        "BEGIN:VEVENT",
        "UID:duracion@test",
        "DTSTAMP:20260701T120000Z",
        "DTSTART;TZID=America/Argentina/Buenos_Aires:20260803T140000",
        "DURATION:PT45M",
        "SUMMARY:Con duración",
        "END:VEVENT",
      ]),
      HASTA
    );

    expect(events[0]).toMatchObject({ date: "2026-08-03", initialHour: "14:00", finalHour: "14:45" });
  });

  it("con saltos de línea sueltos en vez de los del formato", () => {
    // El formato pide CRLF, pero medio mundo exporta con LF a secas.
    const { events } = parseCalendars(
      calendar(
        [
          "BEGIN:VEVENT",
          "UID:lf@test",
          "DTSTAMP:20260701T120000Z",
          "DTSTART;TZID=America/Argentina/Buenos_Aires:20260803T140000",
          "DTEND;TZID=America/Argentina/Buenos_Aires:20260803T150000",
          "SUMMARY:Con LF",
          "END:VEVENT",
        ],
        { salto: "\n" }
      ),
      HASTA
    );

    expect(events).toHaveLength(1);
    expect(events[0].initialHour).toBe("14:00");
  });

  it("con la marca de orden de bytes que le pone Windows al principio", () => {
    const texto = `﻿${calendar([
      "BEGIN:VEVENT",
      "UID:bom@test",
      "DTSTAMP:20260701T120000Z",
      "DTSTART;TZID=America/Argentina/Buenos_Aires:20260803T140000",
      "DTEND;TZID=America/Argentina/Buenos_Aires:20260803T150000",
      "SUMMARY:Con BOM",
      "END:VEVENT",
    ])}`;

    expect(parseCalendars(texto, HASTA).events).toHaveLength(1);
  });

  it("nombrando una zona horaria que el archivo no explica", () => {
    // Pasa cuando alguien recorta un evento de un archivo más grande. No se puede resolver
    // la zona, pero el evento tiene que entrar igual y no tumbar la importación entera.
    const { events } = parseCalendars(
      calendar(
        [
          "BEGIN:VEVENT",
          "UID:sinzona@test",
          "DTSTAMP:20260701T120000Z",
          "DTSTART;TZID=Una/Zona/Que/No/Existe:20260803T140000",
          "DTEND;TZID=Una/Zona/Que/No/Existe:20260803T150000",
          "SUMMARY:Sin bloque de zona",
          "END:VEVENT",
        ],
        { timezone: false }
      ),
      HASTA
    );

    expect(events).toHaveLength(1);
    expect(events[0].date).toBe("2026-08-03");
  });

  it("con la zona escrita como la nombra Windows", () => {
    const { events } = parseCalendars(
      [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:Microsoft Exchange Server 2010",
        "BEGIN:VTIMEZONE",
        "TZID:Argentina Standard Time",
        "BEGIN:STANDARD",
        "DTSTART:16010101T000000",
        "TZOFFSETFROM:-0300",
        "TZOFFSETTO:-0300",
        "END:STANDARD",
        "END:VTIMEZONE",
        "BEGIN:VEVENT",
        "UID:outlook@test",
        "DTSTAMP:20260701T120000Z",
        'DTSTART;TZID="Argentina Standard Time":20260803T140000',
        'DTEND;TZID="Argentina Standard Time":20260803T150000',
        "SUMMARY:Desde Outlook",
        "END:VEVENT",
        "END:VCALENDAR",
        "",
      ].join("\r\n"),
      HASTA
    );

    expect(events[0]).toMatchObject({ date: "2026-08-03", initialHour: "14:00" });
  });

  it("con un recordatorio adentro del evento, como pone Apple", () => {
    const { events } = parseCalendars(
      calendar([
        "BEGIN:VEVENT",
        "UID:alarma@test",
        "DTSTAMP:20260701T120000Z",
        "DTSTART;TZID=America/Argentina/Buenos_Aires:20260803T140000",
        "DTEND;TZID=America/Argentina/Buenos_Aires:20260803T150000",
        "SUMMARY:Con alarma",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "TRIGGER:-PT15M",
        "DESCRIPTION:Recordatorio",
        "END:VALARM",
        "END:VEVENT",
      ]),
      HASTA
    );

    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe("Con alarma");
  });

  it("con comas y saltos escapados adentro del texto", () => {
    const { events } = parseCalendars(
      calendar([
        "BEGIN:VEVENT",
        "UID:escapes@test",
        "DTSTAMP:20260701T120000Z",
        "DTSTART;TZID=America/Argentina/Buenos_Aires:20260803T140000",
        "DTEND;TZID=America/Argentina/Buenos_Aires:20260803T150000",
        "SUMMARY:Pérez\\, Juan — sesión",
        "DESCRIPTION:Primera línea\\nSegunda línea\\; con punto y coma",
        "END:VEVENT",
      ]),
      HASTA
    );

    expect(events[0].summary).toBe("Pérez, Juan — sesión");
    expect(events[0].description).toContain("Segunda línea; con punto y coma");
  });

  it("con fechas sueltas sacadas de una repetición", () => {
    const { events } = parseCalendars(
      calendar([
        "BEGIN:VEVENT",
        "UID:conexdate@test",
        "DTSTAMP:20260701T120000Z",
        "DTSTART;TZID=America/Argentina/Buenos_Aires:20260803T140000",
        "DTEND;TZID=America/Argentina/Buenos_Aires:20260803T150000",
        "RRULE:FREQ=WEEKLY;COUNT=4;BYDAY=MO",
        "EXDATE;TZID=America/Argentina/Buenos_Aires:20260810T140000",
        "SUMMARY:Semanal con una semana borrada",
        "END:VEVENT",
      ]),
      HASTA
    );

    // La del 10 la borró la persona en su calendario: no tiene que volver a aparecer.
    expect(events.map((item) => item.date)).toEqual(["2026-08-03", "2026-08-17", "2026-08-24"]);
  });

  it("con una repetición que termina en una fecha en vez de a las tantas veces", () => {
    const { events } = parseCalendars(
      calendar([
        "BEGIN:VEVENT",
        "UID:hasta@test",
        "DTSTAMP:20260701T120000Z",
        "DTSTART;TZID=America/Argentina/Buenos_Aires:20260803T140000",
        "DTEND;TZID=America/Argentina/Buenos_Aires:20260803T150000",
        "RRULE:FREQ=WEEKLY;UNTIL=20260825T020000Z;BYDAY=MO",
        "SUMMARY:Hasta el 24",
        "END:VEVENT",
      ]),
      HASTA
    );

    expect(events.map((item) => item.date)).toEqual(["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24"]);
  });

  it("con la repetición cada quince días", () => {
    const { events } = parseCalendars(
      calendar([
        "BEGIN:VEVENT",
        "UID:quincenal@test",
        "DTSTAMP:20260701T120000Z",
        "DTSTART;TZID=America/Argentina/Buenos_Aires:20260803T140000",
        "DTEND;TZID=America/Argentina/Buenos_Aires:20260803T150000",
        "RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=3;BYDAY=MO",
        "SUMMARY:Cada quince días",
        "END:VEVENT",
      ]),
      HASTA
    );

    expect(events.map((item) => item.date)).toEqual(["2026-08-03", "2026-08-17", "2026-08-31"]);
  });

  it("con un evento sin hora de fin ni duración", () => {
    const { events } = parseCalendars(
      calendar([
        "BEGIN:VEVENT",
        "UID:sinfin@test",
        "DTSTAMP:20260701T120000Z",
        "DTSTART;TZID=America/Argentina/Buenos_Aires:20260803T140000",
        "SUMMARY:Sin fin",
        "END:VEVENT",
      ]),
      HASTA
    );

    // Entra, pero con largo cero: el importador después lo saltea con ese motivo, que es
    // más útil que hacerlo desaparecer del archivo sin decir nada.
    expect(events).toHaveLength(1);
    expect(events[0].initialHour).toBe(events[0].finalHour);
  });

  it("con propiedades en minúscula", () => {
    const { events } = parseCalendars(
      [
        "begin:vcalendar",
        "version:2.0",
        "begin:vevent",
        "uid:minusculas@test",
        "dtstamp:20260701T120000Z",
        "dtstart:20260803T170000Z",
        "dtend:20260803T180000Z",
        "summary:En minúsculas",
        "end:vevent",
        "end:vcalendar",
        "",
      ].join("\r\n"),
      HASTA
    );

    expect(events[0]).toMatchObject({ date: "2026-08-03", initialHour: "14:00" });
  });

  it("con varios eventos y uno roto en el medio", () => {
    // Un evento sin fecha no puede entrar, pero tampoco puede llevarse puestos a los otros.
    const { events } = parseCalendars(
      calendar([
        "BEGIN:VEVENT",
        "UID:bueno1@test",
        "DTSTAMP:20260701T120000Z",
        "DTSTART;TZID=America/Argentina/Buenos_Aires:20260803T140000",
        "DTEND;TZID=America/Argentina/Buenos_Aires:20260803T150000",
        "SUMMARY:Bueno 1",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:roto@test",
        "DTSTAMP:20260701T120000Z",
        "SUMMARY:Sin fecha",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:bueno2@test",
        "DTSTAMP:20260701T120000Z",
        "DTSTART;TZID=America/Argentina/Buenos_Aires:20260804T140000",
        "DTEND;TZID=America/Argentina/Buenos_Aires:20260804T150000",
        "SUMMARY:Bueno 2",
        "END:VEVENT",
      ]),
      HASTA
    );

    expect(events.map((item) => item.summary)).toEqual(["Bueno 1", "Bueno 2"]);
  });

  it("con el horario de verano de otro país, que corre las horas a mitad de año", () => {
    // Un calendario de Madrid: en agosto está en +02:00, así que las 19:00 de allá son las
    // 14:00 acá. Sin resolver la zona con su bloque, el turno entraría cinco horas corrido.
    const { events } = parseCalendars(
      [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//prueba//EN",
        "BEGIN:VTIMEZONE",
        "TZID:Europe/Madrid",
        "BEGIN:DAYLIGHT",
        "DTSTART:19700329T020000",
        "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
        "TZOFFSETFROM:+0100",
        "TZOFFSETTO:+0200",
        "END:DAYLIGHT",
        "BEGIN:STANDARD",
        "DTSTART:19701025T030000",
        "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
        "TZOFFSETFROM:+0200",
        "TZOFFSETTO:+0100",
        "END:STANDARD",
        "END:VTIMEZONE",
        "BEGIN:VEVENT",
        "UID:madrid@test",
        "DTSTAMP:20260701T120000Z",
        "DTSTART;TZID=Europe/Madrid:20260803T190000",
        "DTEND;TZID=Europe/Madrid:20260803T200000",
        "SUMMARY:Desde Madrid",
        "END:VEVENT",
        "END:VCALENDAR",
        "",
      ].join("\r\n"),
      HASTA
    );

    expect(events[0]).toMatchObject({ date: "2026-08-03", initialHour: "14:00", finalHour: "15:00" });
  });
});
