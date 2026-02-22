import api from "../../axios";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export async function sendMessageToSecretary(
    message: string,
    history: ChatMessage[]
): Promise<{ answer: string; newHistory: ChatMessage[] }> {
    const response = await api.post("/appointments/secretary-response", {
        message,
        history,
    });

    // El backend devuelve: { message: string, data: { content: string, chatHistory: ChatMessage[] } }
    return {
        answer: response.data.data.content,
        newHistory: response.data.data.chatHistory,
    };
}
