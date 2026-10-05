import Groq from "groq-sdk";
import { pagesFor, type Role } from "./assistant.catalog.js";
import { words, type Words } from "../shared/vocabulary.js";
import { DEFAULT_POLICIES, type Policies } from "../shared/policies.js";

/**
 * Las herramientas del asistente, con los roles que pueden usar cada una.
 *
 * El filtro por rol no es cosmético: al modelo se le mandan solamente las herramientas
 * de quien está conversando, y además el servicio vuelve a chequear el rol antes de
 * ejecutar. Lo primero evita que el modelo prometa algo que no puede hacer; lo segundo
 * es lo que impide que una conversación bien escrita le haga llamar una herramienta
 * ajena.
 */
export interface AssistantTool {
  roles: Role[];
  /**
   * Cómo se llama en castellano. Es lo que se muestra en el panel de uso, con las palabras
   * del rubro de esta instalación.
   */
  label: (w: Words) => string;
  /** Escribe en la base. Estas piden confirmación antes de ejecutarse. */
  writes?: boolean;
  definition: Groq.Chat.ChatCompletionTool;
}

function labelOf(label: string | ((w: Words) => string)): (w: Words) => string {
  if (typeof label !== "string") return label;
  const text = label;
  return () => text;
}

const tool = (
  roles: Role[],
  name: string,
  label: string | ((w: Words) => string),
  description: string,
  properties: Record<string, unknown> = {},
  required: string[] = [],
  writes = false
): AssistantTool => ({
  roles,
  label: labelOf(label),
  writes,
  definition: {
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required } },
  },
});

const ALL: Role[] = ["client", "professional", "admin"];

/** El número de turno sale de la lista, nunca de la persona: ver numeroInterno en el prompt. */
const NUMERO_INTERNO =
  "El numeroInterno del turno, tal como figura en la lista de turnos. No se lo pidas a la persona: el turno se identifica por fecha, hora y con quién es.";

export const ASSISTANT_TOOLS: AssistantTool[] = [
  // ---------- para cualquiera ----------

  tool(
    ALL,
    "get_office_info",
    (w) => `Datos ${w.del("lugar")}`,
    "Información general del consultorio: dirección, horario de atención, mail, Instagram y las especialidades que se atienden.",
  ),

  tool(
    ALL,
    "open_page",
    "Abrir una pantalla",
    "Le ofrece a la persona un botón para ir a una pantalla de la aplicación. Usala cuando pidan ir a algún lado o cuando lo que quieren hacer se hace en una pantalla concreta. No inventes claves: usá una de la lista de pantallas del prompt.",
    {
      page: { type: "string", description: "Clave de la pantalla, tal cual figura en la lista de pantallas disponibles." },
      reason: { type: "string", description: "Una frase corta que explique para qué la abrís. Opcional." },
    },
    ["page"]
  ),

  tool(
    ALL,
    "get_professionals",
    (w) => `Buscar ${w.profesionales}`,
    "Lista de profesionales que atienden, con su especialidad y las sucursales donde atiende cada uno.",
    {
      speciality: {
        type: "string",
        description: "Especialidad para filtrar: Psicopedagogía, Psicología, Psiquiatría, Nutrición o Fonoaudiología. Opcional.",
      },
      officeId: { type: "number", description: "ID de la sucursal para filtrar. Opcional." },
    }
  ),

  tool(ALL, "get_offices", "Ver sucursales", "Sucursales activas, con su localidad y horario."),

  tool(
    ALL,
    "get_my_appointments",
    (w) => `Ver ${w.turnos} propi${w.os("turno")}`,
    "Los turnos propios de quien está conversando. Si es paciente, sus turnos; si es profesional, su agenda. Devuelve primero los que están por venir.",
    {
      includePast: { type: "boolean", description: "Incluir también los turnos ya pasados. Por defecto false." },
    }
  ),

  // ---------- paciente ----------

  tool(
    ["client"],
    "get_available_slots",
    "Ver horarios libres",
    "Turnos libres de un profesional en una sucursal, para las próximas dos semanas.",
    {
      professionalEmail: { type: "string", description: "Email del profesional." },
      officeId: { type: "number", description: "ID de la sucursal." },
    },
    ["professionalEmail", "officeId"]
  ),

  tool(
    ["client"],
    "book_appointment",
    (w) => `Sacar ${w.un("turno")}`,
    "Prepara un turno para quien está conversando. NO lo saca: devuelve el resumen de lo que se va a hacer para que se lo muestres y le preguntes si confirma.",
    {
      professionalEmail: { type: "string", description: "Email del profesional." },
      officeId: { type: "number", description: "ID de la sucursal." },
      date: { type: "string", description: "Fecha del turno en formato AAAA-MM-DD." },
      initialHour: { type: "string", description: "Hora de inicio en formato HH:MM." },
    },
    ["professionalEmail", "officeId", "date", "initialHour"],
    true
  ),

  // ---------- turnos propios: cancelar ----------

  tool(
    ["client", "professional"],
    "cancel_appointment",
    (w) => `Cancelar ${w.un("turno")}`,
    "Prepara la cancelación de un turno propio. NO lo cancela: devuelve cuál es el turno para que se lo muestres y le preguntes si confirma.",
    { numAppointment: { type: "number", description: NUMERO_INTERNO } },
    ["numAppointment"],
    true
  ),

  // ---------- profesional ----------

  tool(
    ["professional"],
    "accept_appointment",
    (w) => `Confirmar ${w.un("turno")}`,
    "Prepara la confirmación de un turno que un paciente pidió y está pendiente. NO lo confirma todavía: devuelve el turno para que se lo muestres y le preguntes si está de acuerdo.",
    { numAppointment: { type: "number", description: NUMERO_INTERNO } },
    ["numAppointment"],
    true
  ),

  tool(
    ["professional"],
    "reject_appointment",
    (w) => `Rechazar ${w.un("turno")}`,
    "Prepara el rechazo de un turno pendiente. NO lo rechaza todavía: devuelve el turno para que se lo muestres y le preguntes si confirma. Al rechazarlo, el paciente recibe un mail avisándole.",
    { numAppointment: { type: "number", description: NUMERO_INTERNO } },
    ["numAppointment"],
    true
  ),

  tool(
    ["professional"],
    "get_my_analytics",
    (w) => `Números ${w.del("profesional")}`,
    "Estadísticas propias del profesional: turnos, asistencia, cancelaciones, turnos especiales (sobreturnos), pacientes distintos y facturación, del mes en curso y del acumulado."
  ),

  // ---------- administración ----------

  tool(
    ["admin"],
    "get_office_analytics",
    (w) => `Números ${w.del("lugar")}`,
    "Estadísticas de todo el consultorio: turnos, asistencia, facturación, pacientes y cantidad de profesionales, del mes en curso y del acumulado."
  ),

  tool(
    ["admin"],
    "get_professional_analytics",
    (w) => `Números de ${w.un("profesional")}`,
    "Estadísticas de un profesional en particular: turnos, asistencias, ausencias y turnos especiales (sobreturnos). No incluye lo que factura, que es dato suyo; si te lo preguntan, decilo así y ofrecé el total del consultorio.",
    { professionalEmail: { type: "string", description: "Email del profesional." } },
    ["professionalEmail"]
  ),

  tool(
    ["admin"],
    "get_assistant_usage",
    "Uso del asistente",
    "Cuánto se usó este asistente y cuántos tokens gastó, con el ranking de las funciones más pedidas. Nombrá las funciones por su etiqueta en castellano, nunca por el nombre técnico."
  ),


  tool(
    ["admin"],
    "get_overbooking_this_week",
    (w) => `${w.Turnos} especiales de la semana`,
    "Qué profesionales están dando turnos especiales (sobreturnos) esta semana y cuántos, con el detalle de cada uno.",
    {
      weeksAgo: {
        type: "number",
        description: "0 es la semana en curso, 1 la anterior, y así. Por defecto 0.",
      },
    }
  ),

  // ---------- alquileres (solo el admin: igual que la pantalla) ----------

  tool(
    ["admin"],
    "get_rent_month",
    "Ver los alquileres del mes",
    "Las cuotas de alquiler de los profesionales en un mes: cuánto le toca a cada uno, cuánto pagó, qué saldo le queda, si pagó fuera de término, y los totales del mes. Contesta '¿quién debe alquiler?', '¿cuánto se cobró de alquiler?', '¿pagó Fulano?'. Sin mes, el que corre.",
    {
      month: { type: "string", description: "Mes en formato AAAA-MM. Opcional: por defecto el mes en curso. Se puede pedir hasta el mes que viene." },
      onlyWithBalance: { type: "boolean", description: "true para traer solo a los que todavía deben algo de ese mes. Opcional." },
    }
  ),

  tool(
    ["admin"],
    "get_rent_detail",
    "Ver cómo se arma una cuota",
    "Cómo se calculó la cuota de alquiler de un profesional en un mes: si es un monto fijo o sale de su agenda, qué módulos usa en cada consultorio y día, a qué precio, el ajuste propio y los precios que faltan cargar. Contesta '¿por qué Fulano paga tanto?' o '¿cómo se calcula su alquiler?'.",
    {
      professional: { type: "string", description: "Nombre y apellido del profesional, como figura en get_rent_month." },
      month: { type: "string", description: "Mes en formato AAAA-MM. Opcional: por defecto el mes en curso." },
    },
    ["professional"]
  ),

  tool(
    ["admin"],
    "get_room_prices",
    "Ver los precios de los consultorios",
    "Lo que cuesta por mes cada consultorio en cada módulo (mañana, tarde y día entero), y lo que ya quedó programado para el mes siguiente si cambia.",
    {
      month: { type: "string", description: "Mes en formato AAAA-MM. Opcional: por defecto el mes en curso." },
    }
  ),

  tool(
    ["admin"],
    "register_rent_payment",
    "Registrar un pago de alquiler",
    "Prepara el registro del pago de la cuota de alquiler de un profesional: que pagó todo, que pagó una parte, o borrar un pago cargado por error. NO lo registra todavía: devuelve el resumen para que se lo muestres y le preguntes si confirma.",
    {
      professional: { type: "string", description: "Nombre y apellido del profesional, como figura en get_rent_month." },
      month: { type: "string", description: "Mes de la cuota, en formato AAAA-MM. Opcional: por defecto el mes en curso." },
      status: {
        type: "string",
        enum: ["paid", "partial", "unpaid"],
        description: "paid si pagó la cuota entera, partial si pagó una parte, unpaid para borrar un pago cargado.",
      },
      paidAmount: { type: "number", description: "Solo para partial: cuánto pagó, en pesos y sin puntos." },
      paidOn: { type: "string", description: "Día en que pagó, en formato AAAA-MM-DD. Opcional: por defecto hoy." },
    },
    ["professional", "status"],
    true
  ),
];

/**
 * La herramienta que ejecuta lo que quedó preparado.
 *
 * No lleva argumentos a propósito: qué se va a hacer ya está decidido y guardado del
 * lado del servidor. El modelo solamente dice "sí, dale", y así no puede cambiar el
 * turno, la fecha ni el profesional entre el resumen que mostró y lo que se ejecuta.
 */
const CONFIRM_TOOL = tool(
  ["client", "professional", "admin"],
  "confirm_action",
    "Confirmar la acción",
  "Ejecuta la acción que quedó pendiente de confirmación. Llamala únicamente cuando la persona ya dijo que sí."
);

/**
 * Las herramientas de un rol.
 *
 * `pending` es si hay una acción esperando el sí: sin eso, confirm_action no existe.
 * `specialities` son las del consultorio, para que el filtro de profesionales nombre las
 * que existen acá y no las de otro.
 */
/**
 * Si una herramienta va para este rol con las reglas del consultorio.
 *
 * Lo que la regla no permite no se le ofrece al modelo: si no, la llama, el servicio
 * dice que no, y la persona lee un "no se puede" que nadie le había ofrecido.
 */
export function toolAllowed(name: string, role: Role, p: Policies): boolean {
  if (name.startsWith("get_rent") || name === "get_room_prices" || name === "register_rent_payment") return p.rentModule;
  if (role === "client" && (name === "get_available_slots" || name === "book_appointment")) return p.patientBooking;
  if (name === "cancel_appointment") return role === "client" ? p.patientCancel : p.proCancel;
  return true;
}

export function toolsFor(
  role: Role,
  pending = false,
  specialities: string[] = [],
  p: Policies = DEFAULT_POLICIES
): Groq.Chat.ChatCompletionTool[] {
  const tools = ASSISTANT_TOOLS.filter((item) => item.roles.includes(role) && toolAllowed(item.definition.function!.name, role, p));
  if (pending && CONFIRM_TOOL.roles.includes(role)) tools.push(CONFIRM_TOOL);
  return tools.map((item) => withSpecialities(item.definition, specialities));
}

/** La definición de get_professionals con las especialidades de este consultorio. */
function withSpecialities(definition: Groq.Chat.ChatCompletionTool, specialities: string[]): Groq.Chat.ChatCompletionTool {
  const props: any = (definition.function?.parameters as any)?.properties;
  if (definition.function?.name !== "get_professionals" || !props?.speciality) return definition;

  const list = specialities.length ? `: ${specialities.join(", ")}` : "";
  return {
    ...definition,
    function: {
      ...definition.function,
      parameters: {
        ...(definition.function.parameters as any),
        properties: { ...props, speciality: { ...props.speciality, description: `Especialidad para filtrar${list}. Opcional.` } },
      },
    },
  };
}

/** Nombre en castellano de cada herramienta, para mostrar el uso sin jerga. */
export function toolLabels(w: Words = words()): Record<string, string> {
  const labels: Record<string, string> = { [CONFIRM_TOOL.definition.function!.name]: CONFIRM_TOOL.label(w) };
  for (const item of ASSISTANT_TOOLS) labels[item.definition.function!.name] = item.label(w);
  return labels;
}

export function findTool(name: string): AssistantTool | undefined {
  return ASSISTANT_TOOLS.find((item) => item.definition.function?.name === name);
}

/** Las pantallas que puede ofrecer este rol, listadas para el prompt. */
export function pageMenu(role: Role, p: Policies = DEFAULT_POLICIES): string {
  return pagesFor(role, p)
    .map((page) => `  - ${page.key}: ${page.description}`)
    .join("\n");
}
