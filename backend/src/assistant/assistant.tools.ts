import Groq from "groq-sdk";
import { pagesFor, type Role } from "./assistant.catalog.js";

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
  /** Cómo se llama en castellano. Es lo que se muestra en el panel de uso. */
  label: string;
  /** Escribe en la base. Estas piden confirmación antes de ejecutarse. */
  writes?: boolean;
  definition: Groq.Chat.ChatCompletionTool;
}

const tool = (
  roles: Role[],
  name: string,
  label: string,
  description: string,
  properties: Record<string, unknown> = {},
  required: string[] = [],
  writes = false
): AssistantTool => ({
  roles,
  label,
  writes,
  definition: {
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required } },
  },
});

const ALL: Role[] = ["client", "professional", "admin"];

export const ASSISTANT_TOOLS: AssistantTool[] = [
  // ---------- para cualquiera ----------

  tool(
    ALL,
    "get_office_info",
    "Datos del consultorio",
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
    "Buscar profesionales",
    "Lista de profesionales que atienden, con su especialidad y las sucursales donde atiende cada uno.",
    {
      speciality: {
        type: "string",
        description: "Especialidad para filtrar: Psicopedagogía, Psicología, Nutrición o Fonoaudiología. Opcional.",
      },
      officeId: { type: "number", description: "ID de la sucursal para filtrar. Opcional." },
    }
  ),

  tool(ALL, "get_offices", "Ver sucursales", "Sucursales activas, con su localidad y horario."),

  tool(
    ALL,
    "get_my_appointments",
    "Ver turnos propios",
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
    "Sacar un turno",
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
    "Cancelar un turno",
    "Prepara la cancelación de un turno propio. NO lo cancela: devuelve cuál es el turno para que se lo muestres y le preguntes si confirma.",
    { numAppointment: { type: "number", description: "Número del turno a cancelar." } },
    ["numAppointment"],
    true
  ),

  // ---------- profesional ----------

  tool(
    ["professional"],
    "accept_appointment",
    "Confirmar un turno",
    "Prepara la confirmación de un turno que un paciente pidió y está pendiente. NO lo confirma todavía: devuelve el turno para que se lo muestres y le preguntes si está de acuerdo.",
    { numAppointment: { type: "number", description: "Número del turno pendiente." } },
    ["numAppointment"],
    true
  ),

  tool(
    ["professional"],
    "reject_appointment",
    "Rechazar un turno",
    "Prepara el rechazo de un turno pendiente. NO lo rechaza todavía: devuelve el turno para que se lo muestres y le preguntes si confirma. Al rechazarlo, el paciente recibe un mail avisándole.",
    { numAppointment: { type: "number", description: "Número del turno pendiente." } },
    ["numAppointment"],
    true
  ),

  tool(
    ["professional"],
    "get_my_analytics",
    "Números del profesional",
    "Estadísticas propias del profesional: turnos, asistencia, cancelaciones, sobreturnos, pacientes distintos y facturación, del mes en curso y del acumulado."
  ),

  // ---------- administración ----------

  tool(
    ["admin"],
    "get_office_analytics",
    "Números del consultorio",
    "Estadísticas de todo el consultorio: turnos, asistencia, facturación, pacientes y cantidad de profesionales, del mes en curso y del acumulado."
  ),

  tool(
    ["admin"],
    "get_professional_analytics",
    "Números de un profesional",
    "Estadísticas de un profesional en particular.",
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
    "Sobreturnos de la semana",
    "Qué profesionales están dando sobreturnos esta semana y cuántos, con el detalle de cada uno.",
    {
      weeksAgo: {
        type: "number",
        description: "0 es la semana en curso, 1 la anterior, y así. Por defecto 0.",
      },
    }
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
  ["client", "professional"],
  "confirm_action",
    "Confirmar la acción",
  "Ejecuta la acción que quedó pendiente de confirmación. Llamala únicamente cuando la persona ya dijo que sí."
);

/** `pending` es si hay una acción esperando el sí: sin eso, confirm_action no existe. */
export function toolsFor(role: Role, pending = false): Groq.Chat.ChatCompletionTool[] {
  const tools = ASSISTANT_TOOLS.filter((item) => item.roles.includes(role));
  if (pending && CONFIRM_TOOL.roles.includes(role)) tools.push(CONFIRM_TOOL);
  return tools.map((item) => item.definition);
}

/** Nombre en castellano de cada herramienta, para mostrar el uso sin jerga. */
export function toolLabels(): Record<string, string> {
  const labels: Record<string, string> = { [CONFIRM_TOOL.definition.function!.name]: CONFIRM_TOOL.label };
  for (const item of ASSISTANT_TOOLS) labels[item.definition.function!.name] = item.label;
  return labels;
}

export function findTool(name: string): AssistantTool | undefined {
  return ASSISTANT_TOOLS.find((item) => item.definition.function?.name === name);
}

/** Las pantallas que puede ofrecer este rol, listadas para el prompt. */
export function pageMenu(role: Role): string {
  return pagesFor(role)
    .map((page) => `  - ${page.key}: ${page.description}`)
    .join("\n");
}
