import { useEffect, useState } from "react";
import { Directory, File, Paths } from "expo-file-system";
import { myAnnouncements, type Announcement } from "../api/announcements";
import { myPatientAppointments, pendingAppointments, professionalRange } from "../api/appointments";
import type { Appointment } from "../api/types";
import { addDays, hhmm, longDate, toISODate } from "./dates";
import { fullName, stateOf } from "./appointments";

/**
 * Los avisos de la campanita.
 *
 * Es lo mismo que hay en la web (frontend/src/lib/notifications.ts) y por los mismos
 * motivos: un aviso no es un dato del consultorio sino la lectura que hace la pantalla de
 * datos que ya venía trayendo igual. Guardarlos en la base sería una tabla más, más
 * consultas por persona y una limpieza periódica, todo para repetir algo que se puede
 * deducir de este lado.
 *
 * Cómo se deduce: cada vez que se mira, se guarda una foto de cómo estaban las cosas. La
 * próxima se compara y lo que cambió es la novedad. La primera vez no avisa nada, porque
 * no hay con qué comparar.
 *
 * Se guarda en un archivo del área privada de la app y no en el llavero del sistema: el
 * llavero es para los tokens de la sesión y aguanta poco texto por clave, y esto es una
 * lista que crece. Nada de lo que hay acá es secreto —son títulos que la persona ya vio—
 * y el área privada de la app no la lee nadie más.
 */

export type NotificationTone = "info" | "good" | "warn" | "urgent";

export interface Aviso {
  /** El mismo hecho siempre da el mismo id, así uno borrado no reaparece. */
  id: string;
  title: string;
  body?: string;
  tone: NotificationTone;
  at: number;
  /** A qué pantalla lleva, o null cuando lo que pasó ya no está en ninguna. */
  to: string | null;
}

/** Cuánto se guarda. Más atrás no es una novedad, es un archivo. */
export const DIAS = 3;
const MS = DIAS * 24 * 60 * 60 * 1000;
const TOPE = 40;

interface Guardado {
  lista: Aviso[];
  foto: Record<string, string>;
  /** Hasta cuándo se leyó. Se mueve al abrir la pantalla de avisos. */
  visto: number;
}

const VACIO: Guardado = { lista: [], foto: {}, visto: 0 };

/* ---------- el archivo ---------- */

function archivo(email: string): File | null {
  try {
    const carpeta = new Directory(Paths.document, "avisos");
    if (!carpeta.exists) carpeta.create({ intermediates: true });

    // El mail achicado y no el mail: un nombre de archivo con arroba y puntos es pedir
    // problemas, y acá alcanza con que dos personas no colisionen.
    return new File(carpeta, `${huella(email)}.json`);
  } catch {
    // No hay sistema de archivos. Pasa en el navegador, cuando se miran las pantallas
    // desde una computadora; ahí se guarda en el almacenamiento de la página.
    return null;
  }
}

/**
 * Dónde guardar cuando no hay archivos.
 *
 * Es el navegador y nada más: React Native no tiene localStorage, así que en el teléfono
 * esto siempre da null y manda el archivo. Existe para que mirar las pantallas desde una
 * computadora se comporte como la app de verdad —los avisos sobreviven a recargar— y no
 * para reemplazar nada.
 */
function almacenDePagina(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function huella(email: string): string {
  let hash = 5381;
  for (const letra of email.toLowerCase()) hash = ((hash << 5) + hash + letra.charCodeAt(0)) | 0;
  return Math.abs(hash).toString(36);
}

function leer(email: string): Guardado {
  const memoria = enMemoria.get(email.toLowerCase());
  if (memoria) return memoria;

  try {
    const file = archivo(email);
    const crudo = file ? (file.exists ? file.textSync() : null) : (almacenDePagina()?.getItem(`avisos:${huella(email)}`) ?? null);
    if (!crudo) return VACIO;

    const parsed = JSON.parse(crudo);
    const guardado: Guardado = {
      lista: Array.isArray(parsed?.lista) ? parsed.lista : [],
      foto: parsed?.foto && typeof parsed.foto === "object" ? parsed.foto : {},
      visto: typeof parsed?.visto === "number" ? parsed.visto : 0,
    };

    enMemoria.set(email.toLowerCase(), guardado);
    return guardado;
  } catch {
    return VACIO;
  }
}

/**
 * La copia en memoria manda mientras la app está abierta.
 *
 * Leer el archivo es rápido pero no gratis, y la campanita se dibuja en cada vuelta a
 * Inicio. El archivo es para que los avisos sobrevivan a cerrar la app.
 */
const enMemoria = new Map<string, Guardado>();

function escribir(email: string, guardado: Guardado): void {
  enMemoria.set(email.toLowerCase(), guardado);

  try {
    const file = archivo(email);

    if (!file) {
      almacenDePagina()?.setItem(`avisos:${huella(email)}`, JSON.stringify(guardado));
      return;
    }

    if (!file.exists) file.create();
    file.write(JSON.stringify(guardado));
  } catch {
    // Sin poder escribir, los avisos igual funcionan hasta que se cierre la app.
  }
}

/* ---------- lo que miran las pantallas ---------- */

const escuchando = new Set<() => void>();

function avisarATodos(): void {
  for (const refrescar of escuchando) refrescar();
}

export function readAvisos(email: string): Aviso[] {
  const corte = Date.now() - MS;
  return leer(email)
    .lista.filter((aviso) => aviso.at > corte)
    .sort((a, b) => b.at - a.at);
}

export function sinLeer(email: string): Aviso[] {
  const { visto } = leer(email);
  return readAvisos(email).filter((aviso) => aviso.at > visto);
}

/** Se llama al abrir la pantalla de avisos, que es cuando se dan por leídos. */
export function marcarLeidos(email: string): void {
  escribir(email, { ...leer(email), visto: Date.now() });
  avisarATodos();
}

export function borrarAviso(email: string, id: string): void {
  const guardado = leer(email);
  escribir(email, { ...guardado, lista: guardado.lista.filter((aviso) => aviso.id !== id) });
  avisarATodos();
}

export function borrarTodos(email: string): void {
  escribir(email, { ...leer(email), lista: [] });
  avisarATodos();
}

/** Se van con la sesión: son de quien los recibió, no del teléfono. */
export function olvidarAvisos(email: string): void {
  enMemoria.delete(email.toLowerCase());
  try {
    const file = archivo(email);

    if (!file) {
      almacenDePagina()?.removeItem(`avisos:${huella(email)}`);
      return;
    }

    if (file.exists) file.delete();
  } catch {
    // Nada que borrar.
  }
}

interface Vista {
  avisos: Aviso[];
  /** Cuántos llegaron después de la última vez que se abrió la pantalla. */
  nuevos: number;
  /** Si entre los que no se leyeron hay algo grave. Es lo que hace latir el número. */
  urgente: boolean;
}

function mirar(email: string): Vista {
  const avisos = readAvisos(email);
  const nuevos = sinLeer(email);
  return { avisos, nuevos: nuevos.length, urgente: nuevos.some((aviso) => aviso.tone === "urgent") };
}

/**
 * Los avisos y cuántos quedan sin leer, al día con lo que pase en cualquier pantalla.
 *
 * El valor se guarda en un estado y no se calcula en cada dibujado. Tiene que ser así: el
 * compilador de React memoriza lo que la función devuelve según lo que entra, y lo único
 * que entra acá es el mail, que no cambia nunca. Calculándolo al dibujar, la campanita se
 * quedaba con el número del primer dibujado para siempre.
 */
export function useAvisos(email: string): Vista {
  const [vista, setVista] = useState<Vista>(() => mirar(email));

  useEffect(() => {
    const refrescar = () => setVista(mirar(email));

    escuchando.add(refrescar);
    // Y una vez ahora, por si algo cambió entre el primer dibujado y esta suscripción.
    refrescar();

    return () => {
      escuchando.delete(refrescar);
    };
  }, [email]);

  return vista;
}

/* ---------- de dónde salen ---------- */

const TURNOS = "/(app)/(tabs)/turnos";

const TONO: Record<Announcement["level"], NotificationTone> = {
  error: "urgent",
  warning: "warn",
  news: "info",
};

function huellaTurno(turno: Appointment): string {
  return `${stateOf(turno)}|${String(turno.date).slice(0, 10)}|${hhmm(turno.initialHour)}`;
}

function cuando(turno: Appointment): string {
  return `${longDate(turno.date)} a las ${hhmm(turno.initialHour)}`;
}

function nuevo(id: string, title: string, body: string, tone: NotificationTone, to: string | null): Aviso {
  return { id, title, body, tone, at: Date.now(), to };
}

function partes(huella: string): { estado: string; fecha: string; hora: string } {
  const [estado = "", fecha = "", hora = ""] = huella.split("|");
  return { estado, fecha, hora };
}

/** Lo mismo que le llega por mail al paciente, dicho en la campana. */
function delPaciente(turno: Appointment, antes: string | undefined): Aviso[] {
  const clave = `t${turno.numAppointment}`;
  const ahora = partes(huellaTurno(turno));

  if (antes === undefined) {
    if (ahora.estado === "pending")
      return [nuevo(`${clave}:pedido`, "Tenés un turno pendiente", `${cuando(turno)}. Falta que lo confirmen.`, "info", TURNOS)];
    if (ahora.estado === "accepted") return [nuevo(`${clave}:alta`, "Te anotamos en un turno", cuando(turno), "good", TURNOS)];
    return [];
  }

  const viejo = partes(antes);
  if (viejo.estado === ahora.estado && viejo.fecha === ahora.fecha && viejo.hora === ahora.hora) return [];

  if (ahora.estado === "cancelled") {
    return viejo.estado === "pending"
      ? [nuevo(`${clave}:rechazado`, "No pudimos darte ese turno", "Podés elegir otro horario.", "warn", "/(app)/(tabs)/pedir-turno")]
      : [nuevo(`${clave}:cancelado`, "Se canceló tu turno", `Era ${cuando(turno)}.`, "warn", "/(app)/(tabs)/pedir-turno")];
  }

  if (viejo.estado === "pending" && ahora.estado === "accepted")
    return [nuevo(`${clave}:confirmado`, "Te confirmaron el turno", `${cuando(turno)}. Llegá cinco minutos antes.`, "good", TURNOS)];

  if (viejo.fecha !== ahora.fecha || viejo.hora !== ahora.hora)
    return [nuevo(`${clave}:movido:${ahora.fecha}${ahora.hora}`, "Te cambiamos el turno de horario", `Ahora es ${cuando(turno)}.`, "warn", TURNOS)];

  return [];
}

/**
 * Lo que le cambia al profesional.
 *
 * Corto porque casi todo lo que le pasa a un turno lo hace él. Lo que le llega de afuera
 * son dos cosas, y son las mismas dos por las que hoy le llega un mail.
 */
function delProfesional(turno: Appointment, antes: string | undefined): Aviso[] {
  const clave = `t${turno.numAppointment}`;
  const ahora = partes(huellaTurno(turno));
  const quien = fullName(turno.patient) || "Un paciente";

  if (antes === undefined)
    return ahora.estado === "pending"
      ? [nuevo(`${clave}:pidio`, "Te pidieron un turno", `${quien}, ${cuando(turno)}.`, "warn", TURNOS)]
      : [];

  if (partes(antes).estado === "accepted" && ahora.estado === "cancelled")
    return [nuevo(`${clave}:libre`, "Se te liberó un horario", `${quien} canceló el turno de ${cuando(turno)}.`, "info", TURNOS)];

  return [];
}

function claveDeManana(iso: string): string {
  return `manana:${iso}`;
}

/**
 * Mira si pasó algo y lo guarda. Devuelve cuántos avisos nuevos hubo.
 *
 * La llaman Inicio al abrirse y al refrescar. No tiene reloj propio: el teléfono apaga
 * los temporizadores de una app que está de fondo, así que uno acá sería un temporizador
 * que corre justo cuando nadie mira.
 */
export async function revisarAvisos(role: string, email: string): Promise<number> {
  const { turnos, anuncios, sinRefrescar } = await traer(role);

  const foto: Record<string, string> = {};
  for (const turno of turnos) foto[`t${turno.numAppointment}`] = huellaTurno(turno);
  for (const anuncio of anuncios) {
    if (anuncio.channel === "banner" || !anuncio.active) continue;
    foto[`av${anuncio.id}`] = anuncio.title;
  }

  const manana = toISODate(addDays(new Date(), 1));
  const deManana = turnos.filter((turno) => stateOf(turno) === "accepted" && String(turno.date).slice(0, 10) === manana);
  if (deManana.length > 0) foto[claveDeManana(manana)] = String(deManana.length);

  const guardado = leer(email);
  const primeraVez = Object.keys(guardado.foto).length === 0;

  // Primera foto de todas y encima incompleta: no se guarda nada. Guardar media foto haría
  // que la próxima vuelta ya no cuente como primera y anuncie como nuevo todo lo que la
  // parte que falló no alcanzó a registrar.
  if (primeraVez && sinRefrescar.length > 0) return 0;

  const nuevos: Aviso[] = [];

  if (!primeraVez) {
    for (const turno of turnos) {
      const antes = guardado.foto[`t${turno.numAppointment}`];
      nuevos.push(...(role === "professional" ? delProfesional(turno, antes) : delPaciente(turno, antes)));
    }

    for (const anuncio of anuncios) {
      if (anuncio.channel === "banner" || !anuncio.active) continue;
      if (guardado.foto[`av${anuncio.id}`] !== undefined) continue;
      nuevos.push({ id: `av${anuncio.id}`, title: anuncio.title, body: anuncio.body, tone: TONO[anuncio.level] ?? "info", at: Date.now(), to: null });
    }

    if (deManana.length > 0 && guardado.foto[claveDeManana(manana)] === undefined) {
      const primero = [...deManana].sort((a, b) => hhmm(a.initialHour).localeCompare(hhmm(b.initialHour)))[0];
      nuevos.push(
        role === "professional"
          ? nuevo(
              claveDeManana(manana),
              deManana.length === 1 ? "Mañana tenés un turno" : `Mañana tenés ${deManana.length} turnos`,
              `El primero, a las ${hhmm(primero.initialHour)}.`,
              "info",
              TURNOS
            )
          : nuevo(claveDeManana(manana), "Mañana tenés turno", `${cuando(primero)}. Es en 9 de Julio 3672.`, "info", TURNOS)
      );
    }
  }

  const conocidos = new Set(guardado.lista.map((aviso) => aviso.id));
  const corte = Date.now() - MS;

  const lista = [...guardado.lista, ...nuevos.filter((aviso) => !conocidos.has(aviso.id))]
    .filter((aviso) => aviso.at > corte)
    .sort((a, b) => b.at - a.at)
    .slice(0, TOPE);

  // Lo que no se pudo volver a preguntar se conserva como estaba. Pisarlo con nada dejaba
  // la foto vacía y la vuelta siguiente la leía como la primera de todas, así que lo que
  // hubiera cambiado en el medio no se avisaba nunca. Dejarlo afuera sin conservarlo es
  // peor: la vuelta siguiente ve cada turno sin huella previa y los anuncia todos como
  // recién aparecidos.
  const guardada = { ...foto };
  for (const [clave, valor] of Object.entries(guardado.foto)) {
    if (sinRefrescar.some((prefijo) => clave.startsWith(prefijo))) guardada[clave] = valor;
  }

  escribir(email, { lista, foto: guardada, visto: guardado.visto });
  avisarATodos();

  return lista.length - guardado.lista.filter((aviso) => aviso.at > corte).length;
}

/**
 * Qué prefijo de clave usa cada cosa dentro de la foto.
 *
 * Hace falta nombrarlos porque cuando una fuente no contesta hay que conservar sus claves
 * tal como estaban, y para eso hay que saber cuáles son suyas. El recordatorio de mañana
 * sale de los turnos, así que se cae y se conserva con ellos.
 */
const CLAVES_DE_TURNOS = ["t", "manana:"];
const CLAVES_DE_ANUNCIOS = ["av"];

/** Lo que se pudo traer, o la marca de que no se pudo. */
type Traido<T> = { ok: true; datos: T } | { ok: false };

/**
 * Pide algo sin dejar que un error corte la vuelta entera.
 *
 * Devuelve si salió, en vez de una lista vacía. Son dos cosas distintas y confundirlas es
 * lo que hacía que un servidor caído se leyera como "no tenés nada" y borrara la foto.
 */
function pedir<T>(pedido: Promise<T>): Promise<Traido<T>> {
  return pedido.then((datos) => ({ ok: true as const, datos })).catch(() => ({ ok: false as const }));
}

interface LoQueSePudo {
  turnos: Appointment[];
  anuncios: Announcement[];
  /** Prefijos de clave que esta vuelta no se pudieron volver a preguntar. */
  sinRefrescar: string[];
}

/** Los mismos listados que las pantallas ya piden. Ninguna consulta nueva al servidor. */
async function traer(role: string): Promise<LoQueSePudo> {
  const anuncios = pedir(myAnnouncements());

  if (role === "professional") {
    const hoy = new Date();
    const turnos = pedir(professionalRange(toISODate(addDays(hoy, -3)), toISODate(addDays(hoy, 21)), true));
    // Los pedidos sin contestar van aparte de la ventana de tres semanas. Uno para dentro
    // de dos meses no entra ahí, y es justo el que nadie va a mirar hasta que se venza.
    const pedidos = pedir(pendingAppointments());

    const [enVentana, pendientes, avisos] = await Promise.all([turnos, pedidos, anuncios]);

    // Los turnos salen de dos listados que se completan entre sí, así que alcanza con que
    // falle uno para que la foto quede incompleta. Media agenda es peor que ninguna.
    const completos = enVentana.ok && pendientes.ok;

    // El mismo turno puede venir por los dos lados. Repetido, la foto lo guarda dos veces
    // contra la misma clave y el aviso sale duplicado.
    const porNumero = new Map<number, Appointment>();
    if (completos) for (const turno of [...enVentana.datos, ...pendientes.datos]) porNumero.set(turno.numAppointment, turno);

    return {
      turnos: [...porNumero.values()],
      anuncios: avisos.ok ? avisos.datos : [],
      sinRefrescar: [...(completos ? [] : CLAVES_DE_TURNOS), ...(avisos.ok ? [] : CLAVES_DE_ANUNCIOS)],
    };
  }

  if (role === "client") {
    const [turnos, avisos] = await Promise.all([pedir(myPatientAppointments(0, true)), anuncios]);

    return {
      turnos: turnos.ok ? turnos.datos : [],
      anuncios: avisos.ok ? avisos.datos : [],
      sinRefrescar: [...(turnos.ok ? [] : CLAVES_DE_TURNOS), ...(avisos.ok ? [] : CLAVES_DE_ANUNCIOS)],
    };
  }

  // El admin no tiene turnos propios: lo suyo son los avisos del consultorio.
  const avisos = await anuncios;
  return {
    turnos: [],
    anuncios: avisos.ok ? avisos.datos : [],
    sinRefrescar: avisos.ok ? [] : CLAVES_DE_ANUNCIOS,
  };
}
