import { describe, it, expect } from "vitest";
import {
  acceptedMail,
  addedMail,
  canceledMail,
  createdMail,
  factsFor,
  newBookingMail,
  rejectedMail,
  reminderMail,
  slotFreedMail,
  tomorrowNotice,
  updatedMail,
  withdrawnMail,
  type MailData,
} from "../appointments/appointmentMails.js";
import { DEFAULT_VOCABULARY, parseVocabulary, words, type Vocabulary } from "../shared/vocabulary.js";

// ============================================================
// Los mails de turnos, con las palabras del rubro.
//
// La primera parte es la promesa: con las palabras de siempre, cada mail dice letra por
// letra lo que decía antes de que existiera el vocabulario. Las frases de acá abajo están
// copiadas del código anterior; si una deja de aparecer, un consultorio recibe un mail
// distinto sin que nadie lo haya decidido.
//
// La segunda es la razón de todo esto: con otras palabras, concuerdan el artículo y el
// adjetivo, y no queda ninguna de las de antes.
// ============================================================

const W = words();

function data(w = W): MailData {
  return {
    facts: factsFor(w, "patient", {
      date: "martes 6 de octubre",
      start: "10:30",
      end: "11:15",
      professional: "Ana Pérez",
      patient: "Juan Gómez",
      room: "Consultorio naranja",
    }),
    when: "martes 6 de octubre a las 10:30",
    agenda: "martes 6 de octubre de 10:30 a 11:15",
    patient: "Juan Gómez",
    professional: "Ana Pérez",
    url: (path) => `https://ejemplo.com${path}`,
    shortNoticeHours: 24,
  };
}

const ADVICE = "Se recomienda llegar cinco minutos antes";

describe("con las palabras de siempre, los mails dicen lo que decían", () => {
  it("el pedido", () => {
    const m = createdMail(W, data());
    expect(m.subject).toBe("Pedimos tu turno");
    expect(m.notice.title).toBe("Tenés un turno pendiente");
    expect(m.notice.body).toBe("martes 6 de octubre a las 10:30. Falta que el profesional lo confirme.");
    expect(m.html).toContain("Ya tenemos tu pedido. Falta que el profesional lo confirme y te avisamos apenas lo haga.");
    expect(m.html).toContain("El turno que pediste");
    expect(m.html).toContain("Ver mis turnos");
    expect(m.html).toContain("Si lo pediste sin querer, cancelalo desde tus turnos.");
  });

  it("el cambio de horario", () => {
    const m = updatedMail(W, data());
    expect(m.subject).toBe("Cambiamos tu turno de horario");
    expect(m.notice.title).toBe("Te cambiamos el turno de horario");
    expect(m.html).toContain("Si este horario no te sirve, podés cancelarlo y pedir otro.");
  });

  it("el rechazo", () => {
    const m = rejectedMail(W, data());
    expect(m.subject).toBe("No pudimos darte ese turno");
    expect(m.notice.body).toBe("El profesional no pudo tomar ese horario. Podés elegir otro.");
    expect(m.html).toContain("El profesional no pudo tomar el horario que pediste.");
    expect(m.html).toContain("El turno que no salió");
  });

  it("la cancelación", () => {
    const m = canceledMail(W, data());
    expect(m.subject).toBe("Se canceló tu turno");
    expect(m.html).toContain("Este turno ya no está en la agenda.");
    expect(m.html).toContain("Turno cancelado");
    expect(m.html).toContain("Pedir otro turno");
  });

  it("la confirmación", () => {
    const m = acceptedMail(W, data(), ADVICE);
    expect(m.subject).toBe("Tu turno está confirmado");
    expect(m.notice.title).toBe("Te confirmaron el turno");
    expect(m.notice.body).toBe("martes 6 de octubre a las 10:30. Se recomienda llegar cinco minutos antes.");
    expect(m.html).toContain("El profesional confirmó el horario. Te esperamos.");
    expect(m.html).toContain("Se recomienda llegar cinco minutos antes. Antes del turno llega un recordatorio.");
    expect(m.html).toContain("¿No vas a poder ir? Cancelalo desde tus turnos así el horario le queda a otra persona.");
  });

  it("el alta hecha por el profesional, con y sin los datos del turno", () => {
    const url = (path: string) => `https://ejemplo.com${path}`;

    const con = addedMail(W, data(), url);
    expect(con.subject).toBe("Te anotamos en un turno");
    expect(con.notice.body).toBe("martes 6 de octubre a las 10:30, con Ana Pérez.");
    expect(con.html).toContain("Desde el consultorio te asignaron un turno, y ya está confirmado.");
    expect(con.html).toContain("Si no esperabas este turno, avisanos. Puede ser un error de carga.");

    const sin = addedMail(W, null, url);
    expect(sin.notice.body).toBe("Desde el consultorio te asignaron un turno. Entrá para ver el día y la hora.");
    expect(sin.html).toContain("https://ejemplo.com/AppointmentsList");
  });

  it("el recordatorio, de mañana, de hoy y más adelante", () => {
    const links = { yes: "https://ejemplo.com/si", no: "https://ejemplo.com/no" };
    const manana = reminderMail(W, data(), { day: "tomorrow", address: "9 de Julio 3672", advice: ADVICE, links });

    expect(manana.subject).toBe("Mañana tenés turno");
    expect(manana.html).toContain("Turno de mañana");
    expect(manana.html).toContain("En <strong>9 de Julio 3672</strong>. Se recomienda llegar cinco minutos antes.");
    expect(manana.html).toContain("La respuesta le avisa al profesional con tiempo.");
    expect(manana.html).toContain("Cancelar turno");
    expect(manana.html).toContain("El turno también figura en");
    expect(manana.notice.body).toBe("martes 6 de octubre a las 10:30. Es en 9 de Julio 3672.");

    expect(reminderMail(W, data(), { day: "today", address: "", advice: "", links }).subject).toBe("Hoy tenés turno");

    const lejos = reminderMail(W, data(), { day: { date: "martes 6 de octubre" }, address: "", advice: "", links: null });
    expect(lejos.subject).toBe("Tenés turno el martes 6 de octubre");
    expect(lejos.html).toContain("Próximo turno");
    expect(lejos.html).toContain("Para cancelar, conviene hacerlo hoy.");
  });

  it("los del profesional", () => {
    const pedido = newBookingMail(W, data(), true);
    expect(pedido.subject).toBe("Te pidieron un turno");
    expect(pedido.notice.body).toBe("Juan Gómez, martes 6 de octubre de 10:30 a 11:15.");
    expect(pedido.html).toContain("Un paciente pidió un horario tuyo. Queda esperando hasta que lo contestes.");
    expect(pedido.html).toContain("Si no lo contestás, el pedido se da de baja solo cuando pasa la hora del turno.");

    const solo = newBookingMail(W, data(), false);
    expect(solo.subject).toBe("Te sacaron un turno");
    expect(solo.html).toContain("Un paciente sacó un turno y quedó confirmado solo, como lo tenés configurado.");

    const baja = withdrawnMail(W, data());
    expect(baja.html).toContain("Un paciente dio de baja un turno que te había pedido y que no habías contestado.");

    const libre = slotFreedMail(W, data(), false);
    expect(libre.subject).toBe("Se te liberó un horario");
    expect(libre.notice.body).toBe("Juan Gómez canceló el turno de martes 6 de octubre de 10:30 a 11:15.");
    expect(libre.html).toContain("Un paciente canceló su turno, así que ese horario vuelve a estar disponible.");

    const tarde = slotFreedMail(W, data(), true);
    expect(tarde.notice.title).toBe("Te cancelaron un turno sobre la hora");
    expect(tarde.notice.body).toContain("con menos de un día de aviso");

    expect(tomorrowNotice(W, 1, "09:00")).toEqual({ title: "Mañana tenés un turno", body: "El primero, a las 09:00." });
    expect(tomorrowNotice(W, 14, "09:00").title).toBe("Mañana tenés 14 turnos");
  });

  it("la ficha del turno nombra las mismas cosas", () => {
    const profesional = factsFor(W, "professional", { date: "d", start: "s", end: "e", professional: "p", patient: "q", room: "r" });
    expect(profesional.map((f) => f.label)).toEqual(["Fecha", "Hora de inicio", "Hora de fin", "Paciente", "Consultorio"]);
  });
});

describe("con otras palabras", () => {
  // Un estudio de yoga: la clase, la instructora, la alumna, el estudio y el aula.
  const YOGA: Vocabulary = {
    turno: { one: "clase", many: "clases", gender: "f" },
    profesional: { one: "instructora", many: "instructoras", gender: "f" },
    paciente: { one: "alumna", many: "alumnas", gender: "f" },
    lugar: { one: "estudio", many: "estudios", gender: "m" },
    sala: { one: "aula", many: "aulas", gender: "f" },
    especialidad: { one: "disciplina", many: "disciplinas", gender: "f" },
    sucursal: { one: "sede", many: "sedes", gender: "f" },
  };
  const Y = words(YOGA);

  it("concuerdan el artículo, el adjetivo y el pronombre", () => {
    expect(acceptedMail(Y, data(Y), "").subject).toBe("Tu clase está confirmada");
    expect(createdMail(Y, data(Y)).notice.body).toContain("Falta que la instructora la confirme.");
    expect(canceledMail(Y, data(Y)).html).toContain("Esta clase ya no está en la agenda.");
    expect(canceledMail(Y, data(Y)).html).toContain("Clase cancelada");
    expect(canceledMail(Y, data(Y)).html).toContain("Pedir otra clase");
    expect(rejectedMail(Y, data(Y)).subject).toBe("No pudimos darte esa clase");
    expect(newBookingMail(Y, data(Y), false).html).toContain("Una alumna sacó una clase y quedó confirmada sola");
    expect(tomorrowNotice(Y, 3, "08:00")).toEqual({ title: "Mañana tenés 3 clases", body: "La primera, a las 08:00." });
  });

  it("el lugar y el aula no se confunden", () => {
    const alta = addedMail(Y, data(Y), (p) => p);
    expect(alta.html).toContain("Desde el estudio te asignaron una clase");
    expect(factsFor(Y, "professional", { date: "d", start: "s", end: "e", professional: "p", patient: "q", room: "r" }).map((f) => f.label)).toContain("Aula");
  });

  it("no queda ninguna palabra de antes", () => {
    const todos = [
      createdMail(Y, data(Y)),
      updatedMail(Y, data(Y)),
      rejectedMail(Y, data(Y)),
      canceledMail(Y, data(Y)),
      acceptedMail(Y, data(Y), ""),
      addedMail(Y, data(Y), (p) => p),
      reminderMail(Y, data(Y), { day: "tomorrow", address: "", advice: "", links: { yes: "a", no: "b" } }),
      newBookingMail(Y, data(Y), true),
      withdrawnMail(Y, data(Y)),
      slotFreedMail(Y, data(Y), true),
    ];

    for (const mail of todos) {
      // Lo que se lee, sin las direcciones de los links: la ruta /AppointmentsList no es texto.
      const leido = `${mail.subject} ${mail.notice.title} ${mail.notice.body} ${mail.html.replace(/href="[^"]*"/g, "")}`;
      for (const vieja of [/\bturnos?\b/i, /\bprofesional(es)?\b/i, /\bpacientes?\b/i, /\bconsultorios?\b/i]) {
        expect(leido).not.toMatch(vieja);
      }
    }
  });
});

describe("el vocabulario que llega de afuera", () => {
  it("lo que falta toma lo de siempre", () => {
    const parsed = parseVocabulary({ turno: { one: "cita", many: "citas", gender: "f" } });
    expect("vocabulary" in parsed && parsed.vocabulary.profesional).toEqual(DEFAULT_VOCABULARY.profesional);
  });

  it("guarda en minúscula", () => {
    const parsed = parseVocabulary({ turno: { one: "Cita", many: "Citas", gender: "f" } });
    expect("vocabulary" in parsed && parsed.vocabulary.turno.one).toBe("cita");
  });

  it("rechaza lo que no es una palabra", () => {
    expect(parseVocabulary({ turno: { one: "<b>cita</b>", many: "citas", gender: "f" } })).toHaveProperty("problem");
    expect(parseVocabulary({ turno: { one: "", many: "citas", gender: "f" } })).toHaveProperty("problem");
    expect(parseVocabulary({ turno: { one: "cita", many: "citas", gender: "x" } })).toHaveProperty("problem");
  });
});

describe("con varias sucursales", () => {
  const W = words();
  const base = { date: "d", start: "s", end: "e", professional: "p", patient: "q", room: "r" };

  it("el mail dice en qué sucursal es el turno, a los dos lados", () => {
    expect(factsFor(W, "patient", { ...base, branch: "Centro" })).toContainEqual({ label: "Sucursal", value: "Centro" });
    expect(factsFor(W, "professional", { ...base, branch: "Centro" })).toContainEqual({ label: "Sucursal", value: "Centro" });
  });

  it("con una sola, no se nombra: el mail queda como siempre", () => {
    expect(factsFor(W, "patient", base).map((f) => f.label)).toEqual(["Fecha", "Hora", "Profesional"]);
  });

  it("la sucursal sale con la palabra del cliente", () => {
    const sedes = words({ ...DEFAULT_VOCABULARY, sucursal: { one: "sede", many: "sedes", gender: "f" } });
    expect(factsFor(sedes, "patient", { ...base, branch: "Norte" })).toContainEqual({ label: "Sede", value: "Norte" });
  });

  it("un vocabulario guardado antes de que existiera la sucursal no rompe nada", () => {
    const { sucursal: _sinSucursal, ...viejo } = DEFAULT_VOCABULARY;
    expect(words(viejo as typeof DEFAULT_VOCABULARY).Sucursal).toBe("Sucursal");
  });
});
