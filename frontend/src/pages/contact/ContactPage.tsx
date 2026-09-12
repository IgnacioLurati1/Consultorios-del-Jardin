import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FaArrowRight, FaCircleCheck, FaClock, FaEnvelope, FaInstagram, FaLocationDot, FaRegPaperPlane } from "react-icons/fa6";
import { SteppedForm, type FormStep } from "../../components/steppedForm/SteppedForm.tsx";
import { Toasts } from "../../components/toast/Toasts.tsx";
import { useAuth } from "../../context/AuthContext";
import { findPerson, getDecodedToken } from "../commonServices";
import {
  MAX_MESSAGE,
  REASONS,
  emptyContactForm,
  sendContactMessage,
  validateMessage,
  validatePerson,
  validateReason,
  type ContactForm,
} from "./contactFields.ts";
import "./contact.css";

const MAIL = "consultoriosjardinok@gmail.com";
const INSTAGRAM = "consultorios_jardin";

/** Los datos fijos del consultorio. `href` los vuelve accionables desde el celular. */
const OFFICE = [
  { icon: FaLocationDot, label: "Dirección", value: "9 de Julio 3672" },
  { icon: FaClock, label: "Horario", value: "Lunes a viernes, de 9 a 20" },
  { icon: FaEnvelope, label: "Mail", value: MAIL, href: `mailto:${MAIL}`, small: true },
  {
    icon: FaInstagram,
    label: "Instagram",
    value: `@${INSTAGRAM}`,
    href: `https://instagram.com/${INSTAGRAM}`,
    external: true,
  },
];

const SHORTCUTS = [
  { label: "Solicitar turno", to: "/Appointment" },
  { label: "Ver mis turnos", to: "/AppointmentsList" },
];

/**
 * Contacto por mail, en tres pasos.
 *
 * Son seis campos: pedirlos todos juntos convierte una consulta de dos renglones en un
 * formulario que da pereza empezar. Partido, cada pantalla pide una sola cosa y el
 * mensaje —lo único que importa de verdad— queda para el final, con lugar para escribir.
 */
export function ContactPage() {
  const { token } = useAuth();

  // "Quiero trabajar acá" del menú llega con ?motivo=profesional: el motivo ya viene
  // elegido y queda un paso menos. Solo se acepta uno de la lista.
  const [params] = useSearchParams();
  const askedReason = params.get("motivo");
  const validReason = REASONS.some((reason) => reason.id === askedReason) ? askedReason : null;

  const [form, setForm] = useState<ContactForm>(() => ({ ...emptyContactForm, reason: validReason ?? "" }));

  // Tocar el link de la barra estando ya en esta pantalla cambia la dirección pero no
  // vuelve a montar el formulario.
  useEffect(() => {
    if (validReason) setForm((prev) => ({ ...prev, reason: validReason }));
  }, [validReason]);
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const set = (field: keyof ContactForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setServerError(null);
  };

  // Si ya hay sesión, los datos de contacto se completan solos: nadie tiene que
  // escribir su propio nombre en la app en la que ya está adentro.
  useEffect(() => {
    const decoded = token ? getDecodedToken() : null;
    if (!decoded) return;

    findPerson(decoded.email)
      .then((person) => {
        if (!person) return;
        setForm((prev) => ({
          ...prev,
          name: prev.name || `${person.name} ${person.surname}`.trim(),
          email: prev.email || person.email,
          phone: prev.phone || person.phoneNumber || "",
        }));
      })
      .catch(() => undefined);
  }, [token]);

  function handleSubmit() {
    setSending(true);

    sendContactMessage(form)
      .then(() => setSent(form.email.trim()))
      .catch((error: Error) => setServerError(error.message))
      .finally(() => setSending(false));
  }

  const left = MAX_MESSAGE - form.message.trim().length;

  const steps: FormStep[] = [
    {
      id: "motivo",
      title: "Motivo",
      hint: "Tema de la consulta.",
      validate: () => validateReason(form),
      content: (
        <div className="contact-reasons">
          {REASONS.map((reason) => (
            <button
              key={reason.id}
              type="button"
              className={`contact-reason ${form.reason === reason.id ? "active" : ""}`}
              aria-pressed={form.reason === reason.id}
              onClick={() => set("reason", reason.id)}
            >
              <span className="contact-reason-label">{reason.label}</span>
              <span className="contact-reason-hint">{reason.hint}</span>
            </button>
          ))}
        </div>
      ),
    },
    {
      id: "datos",
      title: "Datos",
      hint: "Datos para la respuesta.",
      validate: () => validatePerson(form),
      content: (
        <>
          <label className="ui-field">
            <span>Nombre y apellido</span>
            <input value={form.name} autoComplete="name" onChange={(e) => set("name", e.target.value)} />
          </label>

          <label className="ui-field">
            <span>Email</span>
            <input
              type="email"
              placeholder="nombre@mail.com"
              autoComplete="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
            <small>Destino de la respuesta.</small>
          </label>

          <label className="ui-field">
            <span>Teléfono (opcional)</span>
            <input
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
            <small>Para recibir un llamado.</small>
          </label>
        </>
      ),
    },
    {
      id: "mensaje",
      title: "Mensaje",
      hint: "Detalle de la consulta.",
      validate: () => validateMessage(form),
      content: (
        <>
          <label className="ui-field">
            <span>Mensaje</span>
            <textarea
              rows={7}
              maxLength={MAX_MESSAGE}
              value={form.message}
              onChange={(e) => set("message", e.target.value)}
            />
            {/* El contador aparece recién cerca del tope: antes es un número que no dice nada. */}
            {left < 200 && (
              <small className={left < 100 ? "contact-count low" : "contact-count"}>Quedan {left} caracteres.</small>
            )}
          </label>

          {/* Campo trampa. Está escondido para las personas (y para los lectores de
              pantalla): si llega con texto, lo completó un bot y el backend lo descarta. */}
          <div className="contact-trap" aria-hidden="true">
            <label>
              No completar
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
              />
            </label>
          </div>
        </>
      ),
    },
  ];

  return (
    <div className="adm-page contact-page">
      <Toasts />

      <header className="adm-header">
        <div className="adm-header-titles">
          <h1 className="adm-title">Contacto</h1>
          <p className="adm-subtitle">Respuesta por mail dentro de las 48 horas hábiles.</p>
        </div>
        <Link className="adm-back" to="/">
          Volver al inicio
        </Link>
      </header>

      <div className="contact-layout">
        <div className="contact-form">
          {sent ? (
            <div className="contact-done">
              <span className="contact-done-icon">
                <FaCircleCheck />
              </span>
              <h2 className="contact-done-title">Mensaje enviado</h2>
              <p className="contact-done-text">
                Copia de la consulta enviada a <strong>{sent}</strong>.
              </p>
              <div className="contact-done-actions">
                <Link className="adm-btn adm-btn-primary" to="/">
                  Volver al inicio
                </Link>
                <button
                  type="button"
                  className="adm-btn adm-btn-ghost"
                  onClick={() => {
                    setSent(null);
                    setForm((prev) => ({ ...emptyContactForm, name: prev.name, email: prev.email, phone: prev.phone }));
                  }}
                >
                  Enviar otro mensaje
                </button>
              </div>
            </div>
          ) : (
            <SteppedForm
              title="Consulta"
              steps={steps}
              submitLabel="Enviar mensaje"
              submittingLabel="Enviando…"
              submitting={sending}
              serverError={serverError}
              onSubmit={handleSubmit}
              footerNote={
                <>
                  <FaRegPaperPlane aria-hidden="true" /> Envío por mail a la casilla del consultorio.
                </>
              }
            />
          )}
        </div>

        <aside className="contact-aside">
          <div className="adm-panel contact-office">
            <div className="adm-panel-head">El consultorio</div>
            <ul className="contact-office-list">
              {OFFICE.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.label}>
                    <span className="contact-office-icon">
                      <Icon />
                    </span>
                    <span>
                      <span className="contact-office-label">{item.label}</span>
                      <span className={`contact-office-value ${item.small ? "small" : ""}`}>
                        {item.href ? (
                          <a
                            href={item.href}
                            {...(item.external ? { target: "_blank", rel: "noreferrer" } : {})}
                          >
                            {item.value}
                          </a>
                        ) : (
                          item.value
                        )}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Un turno se resuelve solo desde la app: escribir un mail para eso es el
              camino largo. */}
          <div className="contact-shortcut">
            <p>Gestión de turnos</p>
            <p className="contact-shortcut-text">Solicitud, consulta y cancelación desde la app, sin esperar respuesta.</p>
            <div className="contact-shortcut-actions">
              {SHORTCUTS.map((shortcut) => (
                <Link key={shortcut.to} className="contact-shortcut-link" to={shortcut.to}>
                  {shortcut.label}
                  <FaArrowRight aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
