import crypto from "node:crypto";
import Groq from "groq-sdk";
import { groqClient, GROQ_CONFIG } from "../config/groq.js";
import { AppointmentService } from "../appointments/appointments.service.js";
import { AnalyticsService } from "../analytics/analytics.service.js";
import { PeopleService } from "../people/people.service.js";
import { OfficeService } from "../offices/offices.service.js";
import { Appointment } from "../appointments/appointments.entity.js";
import { AssistantUsage } from "./assistant.entity.js";
import { orm } from "../shared/db/orm.js";
import { startOfDay, toISODate } from "../shared/dates.js";
import { findPage, OFFICE_INFO, type Role } from "./assistant.catalog.js";
import { findTool, toolsFor } from "./assistant.tools.js";
import { buildAssistantPrompt, type AppointmentLine } from "./assistant.prompt.js";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Un botón que el asistente le ofrece a la persona para ir a una pantalla. */
export interface AssistantLink {
  label: string;
  path: string;
}

/**
 * Una acción preparada que espera el sí de la persona.
 *
 * `token` viaja al navegador y vuelve con el mensaje siguiente. Va firmado con una
 * clave que vive solo en este proceso: el navegador lo guarda pero no puede fabricar
 * uno ni cambiarle el turno de adentro. El modelo nunca lo ve.
 */
export interface PendingAction {
  token: string;
  summary: Record<string, unknown>;
}

export interface AssistantReply {
  content: string;
  chatHistory: ChatTurn[];
  links: AssistantLink[];
  /** Qué escribió en la base, si escribió algo. Lo usa el front para refrescar. */
  changed: boolean;
  /** Lo que quedó esperando confirmación, si quedó algo. */
  pendingAction: PendingAction | null;
}

/**
 * Lo que gastó una consulta.
 *
 * Se acumula durante todo el mensaje y se guarda una sola vez al final: si la consulta
 * se rompe a mitad de camino, igual quedó registrado lo que se gastó hasta ahí.
 */
interface Spend {
  promptTokens: number;
  completionTokens: number;
  calls: number;
  tools: string[];
}

/** Cuántas vueltas de herramientas se le permiten antes de cortar. */
const MAX_ITERATIONS = 6;

/** Techo de resultados por herramienta: el modelo no necesita 200 turnos para contestar. */
const MAX_ROWS = 25;

/**
 * Clave para firmar las acciones pendientes.
 *
 * Se genera al arrancar y no se guarda en ningún lado: reiniciar el servidor invalida
 * las confirmaciones que quedaron a mitad de camino, que es exactamente lo que se
 * quiere. Una acción que espera un "sí" desde hace un reinicio ya no es la misma
 * conversación.
 */
const ACTION_SECRET = crypto.randomBytes(32).toString("hex");

/** Una acción preparada vence sola: el "dale" de mañana no ejecuta lo de hoy. */
const ACTION_TTL_MS = 10 * 60 * 1000;

/** Cancelar escribe un ISO timestamp en `state`, así que lo que no está acá es cancelado. */
const LIVE_STATES = ["pending", "accepted", "assisted", "missed"];

const STATE_LABELS: Record<string, string> = {
  pending: "pendiente de confirmación",
  accepted: "confirmado",
  assisted: "asistido",
  missed: "no vino",
};

function stateLabel(state: string): string {
  return STATE_LABELS[state] ?? "cancelado";
}

/** "Psicologia" y "Psicología" son la misma especialidad. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function sign(body: string): string {
  return crypto.createHmac("sha256", ACTION_SECRET).update(body).digest("base64url");
}

function packAction(action: { tool: string; args: any; email: string }): string {
  const body = Buffer.from(JSON.stringify({ ...action, expires: Date.now() + ACTION_TTL_MS })).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Devuelve la acción si el token es nuestro, no venció y es de quien está conversando. */
function unpackAction(token: string, email: string): { tool: string; args: any } {
  const [body, mac] = String(token ?? "").split(".");
  if (!body || !mac) throw new Error("No hay ninguna acción esperando confirmación");

  const given = new Uint8Array(Buffer.from(mac));
  const ours = new Uint8Array(Buffer.from(sign(body)));
  if (given.length !== ours.length || !crypto.timingSafeEqual(given, ours))
    throw new Error("No hay ninguna acción esperando confirmación");

  const action = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (action.email !== email) throw new Error("No hay ninguna acción esperando confirmación");
  if (Date.now() > action.expires) throw new Error("Pasó mucho tiempo desde que lo preguntamos. Pedímelo de nuevo");

  return { tool: action.tool, args: action.args };
}

/**
 * Saca del texto los restos de llamadas a herramientas.
 *
 * gpt-oss a veces, en vez de pedir la herramienta, escribe algo que se le parece en el
 * medio de la respuesta: un `<button open_page ...>`, o los separadores internos del
 * formato con el que razona. Eso no lo tiene que ver nadie. La herramienta no se ejecuta
 * igual, así que además de limpiarlo hay que asegurarse de que quede una frase en pie.
 */
function cleanReply(text: string): string {
  return text
    .replace(/<\|[^|]*\|>/g, "")
    .replace(/<\/?(button|tool|function|call|open_page)[^>]*>/gi, "")
    // La otra forma en que se le escapa una herramienta: el renglón suelto
    // `open_page { "page": "contacto" }` en medio de la respuesta.
    .replace(/^\s*(get|open|book|cancel|accept|reject|confirm)_[a-z_]*\s*[({][^\n]*$/gim, "")
    .replace(/^\s*\[[^\]\n]{1,40}\]\s*$/gm, "")
    // La ventana del chat muestra texto pelado: el markdown se vería crudo.
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Saca el renglón que solo repite el nombre de un botón.
 *
 * Al modelo le sale escribir "Escribirnos" abajo de todo, como si el botón lo tuviera
 * que dibujar él. El botón ya está ahí: repetirlo es una línea suelta que no dice nada.
 */
function dropLinkEcho(text: string, links: AssistantLink[]): string {
  if (links.length === 0) return text;

  const labels = new Set(links.map((link) => link.label.toLowerCase()));
  const bare = (line: string) => line.trim().replace(/^[*_\-\s]+/, "").replace(/[*_:.\-\s]+$/, "").toLowerCase();

  return text
    .split("\n")
    .filter((line) => !labels.has(bare(line)))
    .join("\n")
    .trim();
}

function hhmm(hour: string): string {
  return String(hour ?? "").slice(0, 5);
}

function fullName(person: any): string {
  if (!person) return "";
  return `${person.name ?? ""} ${person.surname ?? ""}`.trim();
}

/**
 * El asistente del consultorio.
 *
 * El modelo no toca la base: pide herramientas, y acá se decide si el rol de quien
 * está conversando puede usarlas y con qué datos. Todas las herramientas trabajan
 * siempre sobre el email de la sesión, nunca sobre uno que venga en los argumentos,
 * así que aunque el modelo se confunda no puede mirar los turnos de otra persona.
 */
export class AssistantService {
  private appointments = new AppointmentService();
  private analytics = new AnalyticsService();
  private people = new PeopleService();
  private offices = new OfficeService();

  /** Los turnos propios, en la forma corta que entiende el prompt. */
  private toLines(appointments: Appointment[], role: Role): AppointmentLine[] {
    return appointments.map((appointment) => ({
      numAppointment: appointment.numAppointment,
      date: toISODate(startOfDay(appointment.date)),
      initialHour: hhmm(appointment.initialHour),
      finalHour: hhmm(appointment.finalHour),
      state: stateLabel(appointment.state),
      who:
        role === "client"
          ? fullName(appointment.professional)
          : fullName(appointment.patient) || "sin paciente asignado",
      office: (appointment.room as any)?.office?.description ?? "",
    }));
  }

  private async myAppointments(email: string, role: Role, includePast: boolean): Promise<AppointmentLine[]> {
    const rows =
      role === "professional"
        ? await this.appointments.findProfessionalAppointmentsByEmail(email, 0)
        : await this.appointments.findPatientAppointmentsByEmail(email, 0);

    const today = toISODate(startOfDay(new Date()));
    const lines = this.toLines(rows, role);
    const upcoming = lines.filter((line) => line.date >= today).sort((a, b) => a.date.localeCompare(b.date));

    if (!includePast) return upcoming.slice(0, MAX_ROWS);

    const past = lines.filter((line) => line.date < today);
    return [...upcoming, ...past].slice(0, MAX_ROWS);
  }

  /**
   * Los analytics completos traen doce meses de series para dibujar gráficos. Al modelo
   * se le manda el resumen: el mes en curso y el acumulado, que es lo que se pregunta
   * en una conversación.
   */
  private summarizeMetrics(source: any) {
    if (!source) return null;
    return {
      turnos: source.appointments,
      asistidos: source.assisted,
      noVinieron: source.missed,
      cancelados: source.cancelled,
      sobreturnos: source.overbooked,
      pacientesDistintos: source.patients,
      facturado: source.billed,
      agendadoSinCobrar: source.scheduled,
      sacadosPorElPaciente: source.fromApp,
      cargadosPorElProfesional: source.fromProfessional,
      promedioPorDia: source.averagePerDay,
      diaMasCargado: source.busiestDay,
    };
  }

  private digestAnalytics(data: any) {
    const current = data.recent?.find((month: any) => month.inProgress) ?? data.recent?.[data.recent.length - 1];
    return {
      profesional: data.professional ?? undefined,
      profesionalesActivos: data.headcount ?? undefined,
      mesEnCurso: { mes: current?.label ?? null, ...this.summarizeMetrics(current) },
      acumulado: { meses: data.total?.months ?? null, ...this.summarizeMetrics(data.total) },
      quienDioMasSobreturnos: data.total?.topOverbooker ?? undefined,
    };
  }

  /**
   * Corre una herramienta.
   *
   * `links` se pasa por referencia: `open_page` no devuelve la pantalla como texto sino
   * que la agrega ahí, y el controlador la manda como un botón. Que el modelo escriba
   * la dirección en la respuesta sería peor de leer y más fácil de equivocar.
   */
  private async runTool(
    name: string,
    args: any,
    user: { email: string; role: Role },
    links: AssistantLink[],
    /** Se llena cuando una herramienta que escribe prepara algo y queda esperando el sí. */
    prepared: { action: PendingAction | null },
    /** true cuando esto ya viene de un confirm_action: entonces sí se ejecuta. */
    confirmed = false
  ): Promise<any> {
    const tool = findTool(name);
    if (!tool) throw new Error(`No existe la herramienta ${name}`);
    // El modelo recibe solo las herramientas de su rol, pero esto se vuelve a chequear
    // acá: es lo único que sigue valiendo si la conversación logra confundirlo.
    if (!tool.roles.includes(user.role)) throw new Error("Esa acción no corresponde a tu tipo de cuenta");

    /**
     * Guarda la acción y devuelve el resumen, sin tocar nada.
     *
     * Lo que se ejecuta después es esto que quedó firmado, no lo que el modelo vuelva a
     * escribir en el mensaje siguiente: entre el resumen que leyó la persona y lo que
     * pasa de verdad no hay lugar para que se le mueva un dato.
     */
    const prepare = (summary: Record<string, unknown>) => {
      prepared.action = { token: packAction({ tool: name, args, email: user.email }), summary };
      return { preparado: true, esperandoConfirmacion: summary };
    };

    switch (name) {
      case "get_office_info":
        return OFFICE_INFO;

      case "open_page": {
        const page = findPage(args?.page, user.role);
        if (!page) throw new Error("Esa pantalla no existe o no está disponible para vos");
        if (!links.some((link) => link.path === page.path)) links.push({ label: page.label, path: page.path });
        return { ok: true, boton: page.label };
      }

      case "get_offices": {
        const offices = await this.offices.findAllActiveOffices();
        return offices.map((office: any) => ({
          idInterno: office.idOffice,
          nombre: office.description,
          localidad: office.city?.nameCity ?? null,
          abre: hhmm(office.openingHour),
          cierra: hhmm(office.closingHour),
        }));
      }

      case "get_professionals": {
        const list = await this.people.findProfessionalsWithOffices(args?.officeId);
        const wanted = args?.speciality ? normalize(args.speciality) : null;
        return list
          .filter((professional) => !wanted || normalize(professional.speciality ?? "").includes(wanted))
          .slice(0, MAX_ROWS)
          .map((professional) => ({
            // "Interno" en el nombre del campo no es decorativo: es lo que hace que el
            // modelo entienda que el dato es para llamar otra herramienta y no para
            // escribirlo en la respuesta.
            emailInterno: professional.email,
            nombre: `${professional.name} ${professional.surname}`,
            especialidad: professional.speciality,
            sucursales: (professional.offices ?? []).map((office: any) => ({
              idInterno: office.id,
              nombre: office.name,
              localidad: office.city,
            })),
          }));
      }

      case "get_my_appointments":
        return await this.myAppointments(user.email, user.role, args?.includePast === true);

      case "get_available_slots": {
        const slots = await this.appointments.getAvailableAppointmensForPatient(
          Number(args.officeId),
          String(args.professionalEmail),
          user.email
        );
        return (slots as any[]).slice(0, MAX_ROWS).map((slot) => ({
          fecha: toISODate(startOfDay(slot.date)),
          desde: hhmm(slot.initialHour),
          hasta: hhmm(slot.finalHour),
        }));
      }

      case "book_appointment": {
        const professional = await this.people.findPersonByEmail(String(args.professionalEmail));
        const office = await this.offices.findOficeById(Number(args.officeId));
        const resumen = {
          profesional: fullName(professional),
          especialidad: professional.speciality,
          sucursal: office.description,
          fecha: String(args.date),
          hora: hhmm(String(args.initialHour)),
        };

        if (!confirmed) return prepare(resumen);

        const created = await this.appointments.createPatientAppointment(
          user.email,
          args.date as any,
          String(args.initialHour),
          String(args.professionalEmail),
          Number(args.officeId)
        );
        return {
          ok: true,
          numeroDeTurno: created.numAppointment,
          estado: "pendiente de que el profesional lo confirme",
          ...resumen,
        };
      }

      case "cancel_appointment": {
        const resumen = await this.describeOwnAppointment(Number(args.numAppointment), user);
        if (!confirmed) return prepare(resumen as any);

        await this.appointments.cancelAppointment(
          Number(args.numAppointment),
          user.email,
          user.role === "professional" ? "professional" : "client"
        );
        return { ok: true, cancelado: resumen };
      }

      case "accept_appointment": {
        const resumen = await this.describeOwnAppointment(Number(args.numAppointment), user);
        if (!confirmed) return prepare(resumen as any);

        await this.appointments.acceptAppointment(Number(args.numAppointment), user.email);
        return { ok: true, confirmado: resumen };
      }

      case "reject_appointment": {
        const resumen = await this.describeOwnAppointment(Number(args.numAppointment), user);
        if (!confirmed) return prepare(resumen as any);

        await this.appointments.deleteAppointment(Number(args.numAppointment), user.email);
        return { ok: true, rechazado: resumen };
      }

      case "get_my_analytics":
        return this.digestAnalytics(await this.analytics.forProfessional(user.email));

      case "get_professional_analytics":
        return this.digestAnalytics(await this.analytics.forProfessional(String(args.professionalEmail)));

      case "get_office_analytics":
        return this.digestAnalytics(await this.analytics.forOffice());

      case "get_assistant_usage": {
        const usage = await this.analytics.assistantUsage();
        // Al modelo se le sacan los nombres técnicos: si los ve, los repite tal cual y
        // quien pregunta termina leyendo "open_page" en vez de "abrir una pantalla".
        return {
          ...usage,
          herramientas: usage.herramientas.map((item) => ({ funcion: item.label, veces: item.count })),
          masUsada: usage.masUsada ? { funcion: usage.masUsada.label, veces: usage.masUsada.count } : null,
        };
      }

      case "get_overbooking_this_week":
        return await this.analytics.overbookingByWeek(Number(args?.weeksAgo) || 0);

      default:
        throw new Error(`No existe la herramienta ${name}`);
    }
  }

  /**
   * Describe un turno propio antes de tocarlo.
   *
   * Busca siempre dentro de los turnos de quien está conversando: si el número no es
   * suyo, no existe para él. Sirve para el resumen de confirmación y, de paso, es el
   * chequeo de que el turno le pertenece.
   */
  private async describeOwnAppointment(numAppointment: number, user: { email: string; role: Role }) {
    const rows =
      user.role === "professional"
        ? await this.appointments.findProfessionalAppointmentsByEmail(user.email, 0)
        : await this.appointments.findPatientAppointmentsByEmail(user.email, 0);

    const found = rows.find((appointment) => appointment.numAppointment === numAppointment);
    if (!found) throw new Error("Ese turno no figura entre los tuyos");

    return this.toLines([found], user.role)[0];
  }

  /**
   * Una vuelta contra el modelo, con reintento.
   *
   * gpt-oss a veces devuelve el nombre de la herramienta con basura pegada (`<|channel|>`
   * y demás) y Groq rechaza el pedido entero con "tool_use_failed". No es un error de lo
   * que pedimos: es el modelo que se desordenó, y volver a preguntarle suele alcanzar.
   */
  private async askModel(
    messages: Groq.Chat.ChatCompletionMessageParam[],
    role: Role,
    pending: boolean,
    spend: Spend
  ): Promise<Groq.Chat.ChatCompletion> {
    let last: any;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = (await groqClient.chat.completions.create({
          ...GROQ_CONFIG,
          messages,
          tools: toolsFor(role, pending),
          tool_choice: "auto",
          parallel_tool_calls: false,
        } as any)) as Groq.Chat.ChatCompletion;

        spend.calls += 1;
        spend.promptTokens += response.usage?.prompt_tokens ?? 0;
        spend.completionTokens += response.usage?.completion_tokens ?? 0;

        return response;
      } catch (error: any) {
        last = error;
        const code = error?.error?.error?.code ?? error?.error?.code;
        if (code !== "tool_use_failed") break;
        console.warn(`[Asistente] El modelo devolvió una herramienta mal formada, reintento ${attempt + 1}`);
      }
    }

    console.error("[Asistente] Error de Groq:", last?.message, last?.status, JSON.stringify(last?.error));
    throw last;
  }

  async reply(
    user: { email: string; type: string },
    userMessage: string,
    history: ChatTurn[],
    /** El token de la acción que quedó esperando el sí en el mensaje anterior, si hubo. */
    pendingToken?: string
  ): Promise<AssistantReply> {
    const role = user.type as Role;
    const person = await this.people.findPersonByEmail(user.email);

    // El paciente y el profesional preguntan por sus turnos más que por cualquier otra
    // cosa: van en el prompt para que la respuesta más común no gaste una vuelta extra.
    const mine = role === "admin" ? [] : await this.myAppointments(user.email, role, false);

    // Se abre acá para contarle al modelo de qué se trata el "dale" que puede venir en
    // este mensaje. Si el token está vencido o no es de esta persona, es como si no
    // hubiera nada pendiente.
    let waiting: { tool: string; args: any } | null = null;
    if (pendingToken) {
      try {
        waiting = unpackAction(pendingToken, user.email);
      } catch {
        waiting = null;
      }
    }

    const today = new Date().toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "America/Argentina/Buenos_Aires",
    });

    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: buildAssistantPrompt(role, fullName(person) || person.name, mine, today, waiting?.args ?? null),
      },
      ...history,
      { role: "user", content: userMessage },
    ];

    const links: AssistantLink[] = [];
    const prepared: { action: PendingAction | null } = { action: null };
    const spend: Spend = { promptTokens: 0, completionTokens: 0, calls: 0, tools: [] };
    let changed = false;

    // El consumo se guarda pase lo que pase: si el modelo falla en la tercera vuelta,
    // las dos primeras ya se pagaron igual.
    try {
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const response = await this.askModel(messages, role, !!waiting, spend);

        const choice = response.choices[0];
        messages.push(choice.message as any);

        if (choice.finish_reason !== "tool_calls" || !choice.message.tool_calls?.length) {
          const content =
            dropLinkEcho(cleanReply(choice.message.content ?? ""), links) ||
            "No pude armar una respuesta. ¿Probamos de nuevo?";
          return { content, chatHistory: this.toHistory(messages, links), links, changed, pendingAction: prepared.action };
        }

        for (const call of choice.message.tool_calls) {
          let result: any;
          spend.tools.push(call.function.name);

          try {
            const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};

            if (call.function.name === "confirm_action") {
              if (!waiting) throw new Error("No hay ninguna acción esperando confirmación");
              // Se ejecuta lo que quedó firmado, no lo que el modelo diga ahora.
              result = await this.runTool(waiting.tool, waiting.args, { email: user.email, role }, links, prepared, true);
              changed = true;
              waiting = null;
              // El modelo suele volver a preparar la misma acción antes de confirmarla.
              // Ya ejecutada, esa copia no sirve para nada y quedaría esperando un sí
              // que apuntaría a un turno que ya no está.
              prepared.action = null;
            } else {
              result = await this.runTool(call.function.name, args, { email: user.email, role }, links, prepared);
            }
          } catch (error: any) {
            result = { error: error?.message ?? "No se pudo completar la acción" };
          }

          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) } as any);
        }
      }
    } finally {
      await this.record(user.email, role, spend);
    }

    return {
      content: "Se me hizo largo el trámite y no llegué a una respuesta. ¿Me lo pedís de nuevo, más puntual?",
      chatHistory: this.toHistory(messages, links),
      links,
      changed,
      pendingAction: prepared.action,
    };
  }

  /**
   * Deja registrado lo que costó la consulta.
   *
   * Nunca hace fallar la respuesta: si no se puede escribir la fila, la persona igual
   * tiene que recibir lo que preguntó. Medir el gasto no vale romper el servicio.
   */
  private async record(email: string, role: Role, spend: Spend): Promise<void> {
    if (spend.calls === 0) return;

    try {
      const em = orm.em.fork();
      em.create(AssistantUsage, {
        createdAt: new Date(),
        email,
        role,
        promptTokens: spend.promptTokens,
        completionTokens: spend.completionTokens,
        totalTokens: spend.promptTokens + spend.completionTokens,
        calls: spend.calls,
        tools: JSON.stringify(spend.tools),
      });
      await em.flush();
    } catch (error) {
      console.error("[Asistente] No se pudo registrar el consumo:", error);
    }
  }

  /**
   * El historial que vuelve al navegador.
   *
   * Van solo los mensajes de la persona y las respuestas finales: los pedidos de
   * herramienta y sus resultados se quedan acá. Volverían a entrar como texto en la
   * próxima consulta, y ahí adentro hay datos que el modelo ya usó y no hace falta
   * pasear.
   */
  private toHistory(messages: Groq.Chat.ChatCompletionMessageParam[], links: AssistantLink[]): ChatTurn[] {
    return messages
      .filter(
        (message): message is { role: "user" | "assistant"; content: string } =>
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string" &&
          message.content.length > 0
      )
      .map((message) => ({
        role: message.role,
        // El navegador dibuja el historial, no el campo `content` de la respuesta: si la
        // limpieza no se hiciera acá también, el markdown y los restos de herramientas
        // se verían igual en pantalla.
        content: message.role === "assistant" ? dropLinkEcho(cleanReply(message.content), links) : message.content,
      }))
      .filter((message) => message.content.length > 0);
  }
}
