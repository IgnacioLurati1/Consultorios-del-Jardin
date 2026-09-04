import api from "../../axios";

/**
 * Traer al sistema la agenda que el profesional venía llevando en otro lado.
 *
 * Son dos llamadas contra el mismo archivo y las mismas opciones: la primera cuenta qué
 * pasaría y la segunda lo hace. El archivo se sube dos veces a propósito. La alternativa
 * —que el servidor se guarde el plan entre una y otra— significaría tener el calendario
 * personal de alguien esperando en algún lado, y la cuenta se rehace igual antes de
 * guardar, porque entre que se mira la previa y se aprieta el botón la agenda pudo
 * cambiar.
 */

export type StateChoice = "past-assisted" | "all-accepted" | "all-assisted";
export type PaymentChoice = "past-paid" | "all-paid" | "none" | "unset";

export interface ImportOptions {
  from: string;
  to: string;
  state: StateChoice;
  payment: PaymentChoice;
  keepTitle: boolean;
  /** Traer también los que caen fuera de los horarios de atención. */
  outsideSchedule: boolean;
}

export interface PlannedAppointment {
  date: string;
  initialHour: string;
  finalHour: string;
  idRoom: number;
  room: string;
  value: number | null;
  state: string;
  paymentState: "unpaid" | "paid" | null;
  observations: string | null;
  past: boolean;
  /** No arranca donde arranca un módulo, o no dura lo que dura uno. */
  offGrid: boolean;
  /** No cae en ningún horario de atención: el consultorio salió del más usado. */
  outsideSchedule: boolean;
  summary: string;
}

export interface SkippedEvent {
  summary: string;
  when: string;
  reason: string;
}

export interface ImportPlan {
  planned: PlannedAppointment[];
  skipped: SkippedEvent[];
  read: number;
  outOfRange: number;
  calendars: number;
  truncated: boolean;
}

export interface ImportResult extends ImportPlan {
  created: number;
  failed: number;
}

function backendError(err: any): never {
  throw new Error(err.response?.data?.message || err.message);
}

/**
 * Hay que sacarle el `Content-Type` a esta request.
 *
 * El cliente de la app lo trae puesto en `application/json`, que es lo que manda todo el
 * resto de la aplicación. Para un formulario con un archivo adentro eso está mal: el tipo
 * tiene que ser `multipart/form-data` **y** llevar el separador que el navegador inventa
 * para cada envío. Dejando el header vacío, el navegador lo escribe entero y bien; con el
 * de JSON puesto, el archivo viaja pero del otro lado no se puede separar del resto y
 * llega una request sin archivo.
 */
const asForm = { headers: { "Content-Type": undefined } };

/** El archivo y las opciones, como formulario. */
function body(file: File, options: ImportOptions): FormData {
  const form = new FormData();

  form.append("file", file);
  form.append("from", options.from);
  form.append("to", options.to);
  form.append("state", options.state);
  form.append("payment", options.payment);
  form.append("keepTitle", String(options.keepTitle));
  form.append("outsideSchedule", String(options.outsideSchedule));

  return form;
}

/** Qué entraría, sin guardar nada. */
export function previewCalendarImport(file: File, options: ImportOptions): Promise<ImportPlan> {
  return api
    .post("/calendar/import/preview", body(file, options), asForm)
    .then((response) => response.data.data)
    .catch(backendError);
}

export function runCalendarImport(file: File, options: ImportOptions): Promise<ImportResult> {
  return api
    .post("/calendar/import", body(file, options), asForm)
    .then((response) => response.data.data)
    .catch(backendError);
}

/** Cómo se llaman las opciones en pantalla. Las mismas palabras que usa el modal. */
export const STATE_LABELS: { value: StateChoice; label: string; hint: string }[] = [
  {
    value: "past-assisted",
    label: "Los que ya pasaron, atendidos. Los que vienen, confirmados",
    hint: "Es lo más parecido a lo que pasó de verdad.",
  },
  { value: "all-accepted", label: "Todos confirmados", hint: "Después los vas cerrando vos, uno por uno." },
  { value: "all-assisted", label: "Todos atendidos", hint: "Incluidos los que todavía no se dieron." },
];

export const PAYMENT_LABELS: { value: PaymentChoice; label: string; hint: string }[] = [
  {
    value: "past-paid",
    label: "Los que ya pasaron, cobrados. Los que vienen, sin cobrar",
    hint: "Lo viejo queda saldado. Lo que viene, por cobrar.",
  },
  { value: "all-paid", label: "Todos cobrados", hint: "Ninguno va a figurar como deuda." },
  {
    value: "none",
    label: "Ninguno cobrado",
    hint: "Los pasados aparecen en «Sin cobrar». Si traés años, son muchos.",
  },
  {
    value: "unset",
    label: "No registrar el cobro",
    hint: "No figuran ni cobrados ni adeudados.",
  },
];

/* ============================================================
   Y para el otro lado: llevarse la agenda
   ============================================================ */

export interface ExportOptions {
  from: string;
  to: string;
  /** Incluir los turnos dados de baja, marcados como cancelados en el calendario. */
  includeCancelled: boolean;
  /** Poner el nombre del paciente en el título del evento. */
  withPatientName: boolean;
}

/**
 * Baja la agenda como archivo de calendario.
 *
 * Se pide con la sesión puesta y después se guarda a mano, en vez de apuntar un enlace al
 * servidor: un enlace no lleva el token, así que el servidor contestaría que no hay sesión
 * y el archivo bajaría vacío o no bajaría.
 *
 * Devuelve cuántos turnos entraron, que viaja en un encabezado porque el cuerpo es el
 * archivo. Sirve para no dejar a alguien mirando un `.ics` sin saber si tiene algo.
 */
export async function downloadCalendar(options: ExportOptions): Promise<number> {
  try {
    const response = await api.get("/calendar/export", { params: options, responseType: "blob" });

    const url = URL.createObjectURL(response.data as Blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `turnos-${options.from}-a-${options.to}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Sin esto el archivo queda en memoria hasta que se recargue la página.
    URL.revokeObjectURL(url);

    return Number(response.headers["x-appointments"] ?? 0);
  } catch (err: any) {
    // El error viene como blob, igual que el archivo, así que hay que leerlo para poder
    // mostrar lo que dice el servidor en vez de un "Request failed" genérico.
    const data = err.response?.data;

    if (data instanceof Blob) {
      try {
        throw new Error(JSON.parse(await data.text()).message);
      } catch (parsed: any) {
        if (parsed instanceof Error && parsed.message) throw parsed;
      }
    }

    throw new Error(err.response?.data?.message || err.message);
  }
}
