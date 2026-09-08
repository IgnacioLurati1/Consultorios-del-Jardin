import {
  addDays,
  appointmentDate,
  formatDayLabel,
  isCancelled,
  shortHour,
  toISODate,
} from "../../pages/appointments/appointmentTypes";
import {
  findPatientAppointments,
  findPendingAppointments,
  findProfessionalAppointmentsInRange,
} from "../../pages/appointments/appointmentsService";
import { findMyAnnouncements, type Announcement } from "../../pages/announcements/announcementsService";
import { findCompromisedAccounts } from "../../pages/analytics/compromisedService";
import { applySnapshot, type AppNotification, type NotificationTone } from "../../lib/notifications";
import type { Appointment } from "../../pages/types";

/**
 * De dónde salen los avisos de cada rol.
 *
 * De ninguna pantalla nueva del backend: de los mismos listados que la aplicación ya
 * pedía para dibujarse. Lo único que se agrega es la comparación contra cómo estaban las
 * cosas la vez anterior, que se hace acá y se guarda en el equipo (ver lib/notifications).
 *
 * La lista de hechos es la misma que la de los mails que manda el consultorio, para que
 * no haya dos verdades sobre qué es una novedad. Le sumamos los dos avisos del día
 * siguiente, que por mail salen como recordatorio y acá son lo mismo dicho en la campana.
 */

/** Qué se le muestra a alguien cuya cuenta ya no existiría si tocara el aviso. */
const SIN_DESTINO = null;

const TURNOS = "/AppointmentsList";

/* ---------- turnos ---------- */

/**
 * La huella de un turno.
 *
 * Lleva el estado, el día y la hora, que es todo lo que puede cambiar y de lo que hay
 * algo que decir. El valor y el cobro quedan afuera a propósito: los toca el profesional
 * mientras trabaja y avisarle de sus propios tildes sería ruido.
 */
function huellaTurno(turno: Appointment): string {
  const estado = isCancelled(turno.state) ? "cancelado" : turno.state;
  return `${estado}|${String(turno.date).slice(0, 10)}|${shortHour(turno.initialHour)}`;
}

function cuando(turno: Appointment): string {
  return `${formatDayLabel(appointmentDate(turno.date))} a las ${shortHour(turno.initialHour)}`;
}

function nombre(persona: { name?: string; surname?: string } | null | undefined): string {
  if (!persona?.name) return "";
  return `${persona.name} ${persona.surname ?? ""}`.trim();
}

function aviso(
  id: string,
  title: string,
  body: string,
  tone: NotificationTone,
  to: string | null
): AppNotification {
  return { id, title, body, tone, at: Date.now(), to };
}

/** El estado que guarda la huella, ya separado. */
function partes(huella: string): { estado: string; fecha: string; hora: string } {
  const [estado = "", fecha = "", hora = ""] = huella.split("|");
  return { estado, fecha, hora };
}

/**
 * Lo que le cambió a un paciente.
 *
 * Un turno que aparece de la nada es uno que pidió él o que le cargaron del consultorio.
 * Las dos cosas se dicen igual, porque para el que lo recibe la diferencia no cambia lo
 * que tiene que hacer: esperar la confirmación.
 */
function avisosDelPaciente(turno: Appointment, antes: string | undefined): AppNotification[] {
  const clave = `t${turno.numAppointment}`;
  const ahora = partes(huellaTurno(turno));

  if (antes === undefined) {
    if (ahora.estado === "pending")
      return [aviso(`${clave}:pedido`, "Tenés un turno pendiente", `${cuando(turno)}. Falta que el profesional lo confirme.`, "info", TURNOS)];

    if (ahora.estado === "accepted")
      return [aviso(`${clave}:alta`, "Te anotamos en un turno", cuando(turno), "good", TURNOS)];

    return [];
  }

  const viejo = partes(antes);
  if (viejo.estado === ahora.estado && viejo.fecha === ahora.fecha && viejo.hora === ahora.hora) return [];

  if (ahora.estado === "cancelado") {
    return viejo.estado === "pending"
      ? [aviso(`${clave}:rechazado`, "No pudimos darte ese turno", "El profesional no pudo tomar ese horario. Podés elegir otro.", "warn", "/Appointment")]
      : [aviso(`${clave}:cancelado`, "Se canceló tu turno", `Era ${cuando(turno)}.`, "warn", "/Appointment")];
  }

  if (viejo.estado === "pending" && ahora.estado === "accepted")
    return [aviso(`${clave}:confirmado`, "Te confirmaron el turno", `${cuando(turno)}. Llegá cinco minutos antes.`, "good", TURNOS)];

  if (viejo.fecha !== ahora.fecha || viejo.hora !== ahora.hora)
    return [aviso(`${clave}:movido:${ahora.fecha}${ahora.hora}`, "Te cambiamos el turno de horario", `Ahora es ${cuando(turno)}.`, "warn", TURNOS)];

  return [];
}

/**
 * Lo que le cambia al profesional.
 *
 * Es corto porque casi todo lo que pasa con un turno lo hace él: avisarle de sus propios
 * cambios sería contarle lo que acaba de hacer. Lo que sí le llega de afuera son dos
 * cosas —un paciente que pide y un paciente que cancela— y son las mismas dos por las que
 * hoy le llega un mail.
 */
function avisosDelProfesional(turno: Appointment, antes: string | undefined): AppNotification[] {
  const clave = `t${turno.numAppointment}`;
  const ahora = partes(huellaTurno(turno));
  const quien = nombre(turno.patient) || "Un paciente";

  if (antes === undefined) {
    return ahora.estado === "pending"
      ? [aviso(`${clave}:pidio`, "Te pidieron un turno", `${quien}, ${cuando(turno)}.`, "warn", TURNOS)]
      : [];
  }

  const viejo = partes(antes);
  if (viejo.estado === "accepted" && ahora.estado === "cancelado")
    return [aviso(`${clave}:libre`, "Se te liberó un horario", `${quien} canceló el turno de ${cuando(turno)}.`, "info", TURNOS)];

  return [];
}

/* ---------- avisos del consultorio ---------- */

const TONO_AVISO: Record<Announcement["level"], NotificationTone> = {
  error: "urgent",
  warning: "warn",
  news: "info",
};

/**
 * Los avisos que el consultorio publica.
 *
 * Solo los que se pidieron como notificación. Los que van de cartel ya se ven arriba de
 * la pantalla, y repetirlos acá sería decir dos veces lo mismo en la misma pantalla.
 */
function avisosPublicados(anuncios: Announcement[], foto: Record<string, string>): void {
  for (const anuncio of anuncios) {
    if (anuncio.channel === "banner" || !anuncio.active) continue;
    foto[`av${anuncio.id}`] = anuncio.title;
  }
}

function deAnuncio(anuncio: Announcement): AppNotification {
  return {
    id: `av${anuncio.id}`,
    title: anuncio.title,
    body: anuncio.body,
    tone: TONO_AVISO[anuncio.level] ?? "info",
    at: Date.now(),
    to: SIN_DESTINO,
  };
}

/* ---------- el aviso de mañana ---------- */

/**
 * El recordatorio del día siguiente.
 *
 * No responde a ningún cambio sino a la fecha, así que la clave lleva el día: eso alcanza
 * para que salga una sola vez y para que al día siguiente vuelva a salir con el turno que
 * corresponda. Es el mismo mail que ya se manda la víspera.
 */
function claveDeManana(iso: string): string {
  return `manana:${iso}`;
}

/* ---------- recolección ---------- */

/**
 * Dos listados que se pisan, en uno solo.
 *
 * Los pedidos sin contestar vienen aparte de la ventana de tres semanas y la mayoría
 * están adentro de las dos. Si el mismo turno entra dos veces, la foto lo guarda dos
 * veces contra la misma clave y el aviso sale repetido.
 */
function juntar(...listas: Appointment[][]): Appointment[] {
  const porNumero = new Map<number, Appointment>();
  for (const lista of listas) for (const turno of lista) porNumero.set(turno.numAppointment, turno);
  return [...porNumero.values()];
}

async function recolectarPaciente(email: string): Promise<AppNotification[]> {
  const [turnos, anuncios] = await Promise.all([
    findPatientAppointments(0, true).catch(() => [] as Appointment[]),
    findMyAnnouncements().catch(() => [] as Announcement[]),
  ]);

  const foto: Record<string, string> = {};
  for (const turno of turnos) foto[`t${turno.numAppointment}`] = huellaTurno(turno);
  avisosPublicados(anuncios, foto);

  const manana = toISODate(addDays(new Date(), 1));
  const deManana = turnos.filter(
    (turno) => turno.state === "accepted" && String(turno.date).slice(0, 10) === manana
  );
  if (deManana.length > 0) foto[claveDeManana(manana)] = String(deManana.length);

  return applySnapshot(email, foto, (antes) => {
    const nuevos: AppNotification[] = [];

    for (const turno of turnos) nuevos.push(...avisosDelPaciente(turno, antes[`t${turno.numAppointment}`]));

    for (const anuncio of anuncios) {
      if (anuncio.channel === "banner" || !anuncio.active) continue;
      if (antes[`av${anuncio.id}`] === undefined) nuevos.push(deAnuncio(anuncio));
    }

    if (deManana.length > 0 && antes[claveDeManana(manana)] === undefined) {
      const turno = deManana[0];
      nuevos.push(
        aviso(
          claveDeManana(manana),
          "Mañana tenés turno",
          `${cuando(turno)}. Es en 9 de Julio 3672.`,
          "info",
          TURNOS
        )
      );
    }

    return nuevos;
  });
}

async function recolectarProfesional(email: string): Promise<AppNotification[]> {
  const hoy = new Date();
  const [enVentana, pendientes, anuncios] = await Promise.all([
    // Una ventana y no la primera página del listado: la página trae los quince más
    // recientes por fecha, que en una agenda cargada se llena de turnos de un mes que
    // viene y deja afuera el pedido de mañana.
    findProfessionalAppointmentsInRange(toISODate(addDays(hoy, -3)), toISODate(addDays(hoy, 21)), true).catch(
      () => [] as Appointment[]
    ),
    // Y los pedidos sin contestar, estén donde estén. Es el único aviso que no puede
    // depender de la ventana: un turno pedido para dentro de dos meses no entra en las
    // tres semanas, y el pedido se vence solo si nadie lo mira.
    findPendingAppointments().catch(() => [] as Appointment[]),
    findMyAnnouncements().catch(() => [] as Announcement[]),
  ]);

  const turnos = juntar(enVentana, pendientes);

  const foto: Record<string, string> = {};
  for (const turno of turnos) foto[`t${turno.numAppointment}`] = huellaTurno(turno);
  avisosPublicados(anuncios, foto);

  const manana = toISODate(addDays(hoy, 1));
  const deManana = turnos.filter(
    (turno) => turno.state === "accepted" && String(turno.date).slice(0, 10) === manana
  );
  if (deManana.length > 0) foto[claveDeManana(manana)] = String(deManana.length);

  return applySnapshot(email, foto, (antes) => {
    const nuevos: AppNotification[] = [];

    for (const turno of turnos) nuevos.push(...avisosDelProfesional(turno, antes[`t${turno.numAppointment}`]));

    for (const anuncio of anuncios) {
      if (anuncio.channel === "banner" || !anuncio.active) continue;
      if (antes[`av${anuncio.id}`] === undefined) nuevos.push(deAnuncio(anuncio));
    }

    if (deManana.length > 0 && antes[claveDeManana(manana)] === undefined) {
      const primero = [...deManana].sort((a, b) => shortHour(a.initialHour).localeCompare(shortHour(b.initialHour)))[0];
      nuevos.push(
        aviso(
          claveDeManana(manana),
          deManana.length === 1 ? "Mañana tenés un turno" : `Mañana tenés ${deManana.length} turnos`,
          `El primero, a las ${shortHour(primero.initialHour)}.`,
          "info",
          TURNOS
        )
      );
    }

    return nuevos;
  });
}

/**
 * Lo del admin.
 *
 * No tiene turnos, así que lo suyo son las cuentas que el sistema cerró por parecer estar
 * en manos de otro. Va en rojo y parpadeando: es lo único de toda la aplicación donde
 * enterarse tarde tiene costo de verdad.
 */
async function recolectarAdmin(email: string): Promise<AppNotification[]> {
  const reporte = await findCompromisedAccounts().catch(() => null);
  const cuentas = reporte?.accounts ?? [];

  const foto: Record<string, string> = {};
  for (const cuenta of cuentas) {
    if (!cuenta.bannedAt) continue;
    foto[`seg:${cuenta.email}:${cuenta.bannedAt}`] = cuenta.reason ?? "1";
  }

  return applySnapshot(email, foto, (antes) => {
    const nuevos: AppNotification[] = [];

    for (const cuenta of cuentas) {
      if (!cuenta.bannedAt) continue;
      const clave = `seg:${cuenta.email}:${cuenta.bannedAt}`;
      if (antes[clave] !== undefined) continue;

      nuevos.push(
        aviso(
          clave,
          "Se cerró una cuenta por seguridad",
          `${nombre(cuenta) || cuenta.email}. ${cuenta.reason ?? "Revisá qué pasó antes de volver a abrirla."}`,
          "urgent",
          "/AdminHome/Analytics"
        )
      );
    }

    return nuevos;
  });
}

/** Los avisos de quien esté mirando, ya guardados y listos para dibujar. */
export function collectNotifications(role: string, email: string): Promise<AppNotification[]> {
  if (role === "client") return recolectarPaciente(email);
  if (role === "professional") return recolectarProfesional(email);
  if (role === "admin") return recolectarAdmin(email);
  return Promise.resolve([]);
}
