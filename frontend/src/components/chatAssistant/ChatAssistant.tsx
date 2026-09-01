import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaXmark, FaCommentDots, FaPaperPlane, FaRobot, FaArrowRight } from "react-icons/fa6";
import { getDecodedToken } from "../../pages/commonServices";
import { useAuth } from "../../context/AuthContext";
import { sendMessageToAssistant } from "./chatAssistantService";
import type { ChatLink, ChatMessage } from "./chatAssistantService";
import "./ChatAssistant.css";

// Los botones de pantalla llegan junto con la respuesta, así que van pegados al mensaje
// que los ofreció y no sueltos al final de la conversación.
type DisplayMessage = ChatMessage & { isAction?: boolean; links?: ChatLink[] };

const MAX_HISTORY = 20;

/** Lo que puede hacer el asistente según quién esté logueado. */
const GREETINGS: Record<string, string[]> = {
    client: [
        "Puedo mostrarte tus turnos, buscarte profesionales y sacarte uno nuevo.",
        "Probá con: “¿qué turnos tengo?” o “quiero un turno de nutrición”.",
    ],
    professional: [
        "Puedo mostrarte tu agenda, confirmar o rechazar turnos pendientes y darte tus números.",
        "Probá con: “¿qué tengo mañana?” o “¿cómo vengo este mes?”.",
    ],
    admin: [
        "Puedo darte los números del consultorio, decirte quién está dando sobreturnos y llevarte a cada pantalla del panel.",
        "Probá con: “¿quién hace sobreturnos esta semana?” o “necesito cambiar una provincia”.",
    ],
};

const ROLES = ["client", "professional", "admin"];

// Se suscribe a AuthContext para volver a dibujarse al entrar y salir de la sesión.
// El asistente atiende a los tres roles, con herramientas distintas para cada uno.
export function ChatAssistant() {
    const { token } = useAuth();
    if (!token) return null;
    const decoded = getDecodedToken();
    if (!decoded || !ROLES.includes(decoded.type)) return null;
    return <ChatAssistantWidget role={decoded.type} />;
}

function ChatAssistantWidget({ role }: { role: string }) {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [history, setHistory] = useState<DisplayMessage[]>([]);
    const [pendingMessage, setPendingMessage] = useState<string | null>(null);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
    // Lo que quedó esperando confirmación. Viaja de vuelta con el mensaje siguiente.
    const [pendingAction, setPendingAction] = useState<string | null>(null);
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
            const { newHistory, links, changed, pendingAction: next } = await sendMessageToAssistant(
                trimmed,
                historyPayload,
                pendingAction
            );

            setPendingAction(next);

            // Los botones y la marca de "hecho" son de la última respuesta, no de todas
            // las que dijeron algo parecido antes.
            const lastIndex = newHistory.length - 1;
            setHistory(newHistory.map((msg: ChatMessage, index: number) => ({
                ...msg,
                isAction: index === lastIndex && msg.role === "assistant" && changed,
                links: index === lastIndex && msg.role === "assistant" ? links : undefined,
            })));
        } catch (err: any) {
            const status = err?.response?.status;
            setPendingAction(null);

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
                            <span>Asistente</span>
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
                                <p>¡Hola! Soy el asistente del consultorio.</p>
                                {(GREETINGS[role] ?? GREETINGS.client).map(line => (
                                    <p key={line}>{line}</p>
                                ))}
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
                                                ✓ Listo, quedó hecho
                                            </div>
                                        )}
                                        {msg.content}
                                    </div>

                                    {msg.links?.map(link => (
                                        <button
                                            key={link.path}
                                            type="button"
                                            className="chat-message-link"
                                            onClick={() => {
                                                setIsOpen(false);
                                                navigate(link.path);
                                            }}
                                        >
                                            {link.label}
                                            <FaArrowRight />
                                        </button>
                                    ))}
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
                aria-label="Abrir el asistente"
            >
                {isOpen ? <FaXmark /> : <FaCommentDots />}
            </button>
        </>
    );
}
