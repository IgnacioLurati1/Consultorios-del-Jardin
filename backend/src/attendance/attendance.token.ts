import crypto from "crypto";
import { startOfDay } from "../shared/dates.js";

/**
 * Los links del mail del día anterior: "Sí, voy" y "No puedo ir".
 *
 * Funcionan sin iniciar sesión, que es lo que los hace servir: casi nadie se acuerda de la
 * contraseña para contestar un mail. Lo que los protege es la firma, que dice qué turno
 * es y hasta cuándo vale, y no se puede armar sin la clave del servidor.
 *
 * La clave se deriva de JWT_SECRET con una etiqueta propia y no es la misma: así un link
 * de estos no sirve nunca como sesión, ni una sesión como link, aunque las dos salgan del
 * mismo secreto. Y no es una clave nueva al azar, como la del asistente, porque esa se
 * pierde con cada reinicio y un link que llega por mail tiene que andar al otro día.
 */

function key(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Falta JWT_SECRET para firmar los links de asistencia");
  return crypto.createHmac("sha256", secret).update("asistencia-v1").digest("hex");
}

function mac(body: string): string {
  return crypto.createHmac("sha256", key()).update(body).digest("base64url");
}

/** Vale hasta `expiresAt`, que es la hora en que empieza el turno. */
export function signAttendance(numAppointment: number, expiresAt: Date): string {
  const body = `${numAppointment}.${Math.floor(expiresAt.getTime() / 1000)}`;
  return `${body}.${mac(body)}`;
}

/**
 * Qué turno nombra el link, o null si no es un link nuestro.
 *
 * Vencido y falso se separan porque se dicen distinto: a uno se le explica que el turno
 * ya empezó; al otro, que el link está roto.
 */
export function readAttendance(token: string, now = new Date()): { numAppointment: number; expired: boolean } | null {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 3) return null;

  const [num, exp, given] = parts;
  if (!/^\d+$/.test(num) || !/^\d+$/.test(exp)) return null;

  const ours = new Uint8Array(Buffer.from(mac(`${num}.${exp}`)));
  const theirs = new Uint8Array(Buffer.from(given));
  if (ours.length !== theirs.length || !crypto.timingSafeEqual(ours, theirs)) return null;

  return { numAppointment: Number(num), expired: Number(exp) * 1000 <= now.getTime() };
}

/**
 * Los dos links de un turno, o null si no se pudieron firmar.
 *
 * Que no se puedan firmar no puede frenar el recordatorio: sin los botones el mail sigue
 * sirviendo, y sin el mail la persona se olvida del turno.
 */
export function attendanceLinks(appointment: { numAppointment?: number; date: Date | string; initialHour: string }) {
  try {
    const start = startOfDay(appointment.date);
    const [hours, minutes] = String(appointment.initialHour).split(":").map(Number);
    start.setHours(hours, minutes || 0, 0, 0);

    const token = encodeURIComponent(signAttendance(appointment.numAppointment!, start));
    const base = `${process.env.BASE_URL ?? ""}/asistencia?t=${token}`;

    return { yes: `${base}&r=si`, no: `${base}&r=no` };
  } catch (error) {
    console.error("No se pudieron armar los links de asistencia:", error);
    return null;
  }
}
