import api from "../../axios";

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** Un botón que el asistente ofrece para ir a una pantalla de la aplicación. */
export type ChatLink = { label: string; path: string };

export interface ChatReply {
    answer: string;
    newHistory: ChatMessage[];
    links: ChatLink[];
    /** El asistente tocó turnos: las pantallas abiertas quedaron viejas. */
    changed: boolean;
    /**
     * Token de la acción que quedó esperando un "sí". Se devuelve tal cual en el mensaje
     * siguiente: adentro está lo que se va a hacer, firmado por el backend, así que el
     * asistente no puede cambiar el turno entre lo que preguntó y lo que ejecuta.
     */
    pendingAction: string | null;
}

export async function sendMessageToAssistant(
    message: string,
    history: ChatMessage[],
    pendingAction: string | null
): Promise<ChatReply> {
    const response = await api.post("/assistant/message", { message, history, pendingAction });
    const data = response.data.data;

    return {
        answer: data.content,
        newHistory: data.chatHistory,
        links: data.links ?? [],
        changed: !!data.changed,
        pendingAction: data.pendingAction?.token ?? null,
    };
}
