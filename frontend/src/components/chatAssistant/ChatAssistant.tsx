import { useState, useEffect, useRef } from "react";
import { FaXmark, FaCommentDots, FaPaperPlane, FaRobot } from "react-icons/fa6";
import { getDecodedToken } from "../../pages/commonServices";
import { useAuth } from "../../context/AuthContext";
import { sendMessageToSecretary } from "./chatAssistantService";
import type { ChatMessage } from "./chatAssistantService";
import "./ChatAssistant.css";

type DisplayMessage = ChatMessage & { isAction?: boolean };

const MAX_HISTORY = 20;

function detectAction(text: string): boolean {
    const lower = text.toLowerCase();
    const hasAppointmentRef = lower.includes("turno") || lower.includes("cita");
    const hasActionVerb = ["creado", "cancelado", "agendado", "reservado", "registrado"].some(
        kw => lower.includes(kw)
    );
    return hasAppointmentRef && hasActionVerb;
}

// Wrapper: subscribes to AuthContext so it re-renders on login/logout,
// and only shows the widget for "client" users.
export function ChatAssistant() {
    const { token } = useAuth();
    if (!token) return null;
    const decoded = getDecodedToken();
    if (!decoded || decoded.type !== "client") return null;
    return <ChatAssistantWidget />;
}

function ChatAssistantWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [history, setHistory] = useState<DisplayMessage[]>([]);
    const [pendingMessage, setPendingMessage] = useState<string | null>(null);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [history, pendingMessage, isLoading]);

    useEffect(() => {
        if (rateLimitSeconds <= 0) return;
        const timer = setInterval(() => {
            setRateLimitSeconds(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [rateLimitSeconds]);

    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed || isLoading || rateLimitSeconds > 0) return;

        const historyPayload = history
            .slice(-MAX_HISTORY)
            .map(({ role, content }) => ({ role, content }));
        // Send current history (without the new message) to the backend
        setInput("");
        setPendingMessage(trimmed);
        setIsLoading(true);

        try {
            const { answer, newHistory } = await sendMessageToSecretary(trimmed, historyPayload);
            const isAction = detectAction(answer);
            setHistory(newHistory.map((msg: any) => ({
            ...msg,
            isAction: msg.role === "assistant" && msg.content === answer ? isAction : false
            })));
        } catch (err: any) {
            const status = err?.response?.status;
            if (status === 429) {
                setRateLimitSeconds(60);
                setHistory(prev => [
                    ...prev,
                    { role: "user", content: trimmed },
                    {
                        role: "assistant",
                        content: "⚠️ Límite de mensajes alcanzado. Esperá un momento antes de continuar.",
                    },
                ]);
            } else {
                setHistory(prev => [
                    ...prev,
                    { role: "user", content: trimmed },
                    {
                        role: "assistant",
                        content: "Ocurrió un error al procesar tu mensaje. Por favor intentá de nuevo.",
                    },
                ]);
            }
        } finally {
            setIsLoading(false);
            setPendingMessage(null);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const isInputDisabled = isLoading || rateLimitSeconds > 0;

    return (
        <>
            {isOpen && (
                <div className="chat-assistant-panel">
                    <div className="chat-assistant-header">
                        <div className="chat-assistant-header-title">
                            <FaRobot className="chat-assistant-header-icon" />
                            <span>Asistente de Turnos</span>
                        </div>
                        <button
                            className="chat-assistant-close-btn"
                            onClick={() => setIsOpen(false)}
                            aria-label="Cerrar chat"
                        >
                            <FaXmark />
                        </button>
                    </div>

                    <div className="chat-assistant-messages">
                        {history.length === 0 && !pendingMessage && (
                            <div className="chat-assistant-welcome">
                                <FaRobot className="chat-assistant-welcome-icon" />
                                <p>¡Hola! Soy tu asistente virtual de turnos.</p>
                                <p>Puedo ayudarte a consultar disponibilidad de turnos y recordarte los tuyos</p>
                            </div>
                        )}

                        {history
                            .filter((msg: DisplayMessage) => 
                                // Only shows messages with content
                                msg.role === "user" || (msg.role === "assistant" && msg.content)
                            )
                            .map((msg: DisplayMessage, i: number) => (
                                <div key={i} className={`chat-message chat-message--${msg.role}`}>
                                    <div className={`chat-message-bubble${msg.isAction ? " chat-message-bubble--action" : ""}`}>
                                        {msg.isAction && (
                                            <div className="chat-message-action-badge">
                                                ✓ Acción realizada en el sistema
                                            </div>
                                        )}
                                        {msg.content}
                                    </div>
                                </div>
                            ))
                        }

                        {pendingMessage && (
                            <div className="chat-message chat-message--user">
                                <div className="chat-message-bubble">{pendingMessage}</div>
                            </div>
                        )}

                        {isLoading && (
                            <div className="chat-message chat-message--assistant">
                                <div className="chat-message-bubble chat-message-loading">
                                    <span />
                                    <span />
                                    <span />
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    <div className="chat-assistant-footer">
                        {rateLimitSeconds > 0 && (
                            <div className="chat-rate-limit-notice">
                                Límite alcanzado. Podés enviar otro mensaje en {rateLimitSeconds}s.
                            </div>
                        )}
                        <div className="chat-assistant-input-row">
                            <input
                                className="chat-assistant-input"
                                type="text"
                                placeholder="Escribí tu mensaje..."
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isInputDisabled}
                                aria-label="Mensaje para el asistente"
                            />
                            <button
                                className="chat-assistant-send-btn"
                                onClick={handleSend}
                                disabled={isInputDisabled || !input.trim()}
                                aria-label="Enviar mensaje"
                            >
                                <FaPaperPlane />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <button
                className={`chat-assistant-fab${isOpen ? " chat-assistant-fab--active" : ""}`}
                onClick={() => setIsOpen(o => !o)}
                aria-label="Abrir asistente de turnos"
            >
                {isOpen ? <FaXmark /> : <FaCommentDots />}
            </button>
        </>
    );
}
