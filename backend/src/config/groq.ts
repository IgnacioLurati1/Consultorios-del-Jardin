import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

let client: Groq | undefined;

/**
 * El cliente se arma la primera vez que alguien le escribe al asistente, no al arrancar.
 *
 * Construirlo sin la clave tira una excepción, y hacerlo en el import significaba que esa
 * excepción se llevaba puesto el arranque entero: una clave mal copiada dejaba sin turnos,
 * sin agenda y sin mails a todo el mundo. Sin asistente el sistema funciona igual, así que
 * el problema tiene que quedarse adentro del asistente.
 */
export function groqClient(): Groq {
  if (!client) client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return client;
}

export const GROQ_CONFIG = {
  model: "openai/gpt-oss-20b",
  // Baja: el asistente informa, no escribe cuentos.
  temperature: 0.3,
  // El modelo razona antes de contestar y ese razonamiento también gasta tokens del
  // presupuesto, así que el techo es más alto que el largo de la respuesta esperada.
  max_completion_tokens: 1600,
  // Con esfuerzo bajo contesta rápido, pero se le desarma el formato de las llamadas a
  // herramientas: escribe la etiqueta en el texto en vez de pedirla. Con medio deja de
  // pasar y la demora no se nota.
  reasoning_effort: "medium",
};
