import { useState } from "react";
import { Link } from "react-router-dom";
import { FaEnvelopeCircleCheck } from "react-icons/fa6";
import { Toasts } from "../../components/toast/Toasts.tsx";
import api from "../../axios.ts";
import { useLogo } from "../../lib/useLogo";
import "./passwordPages.css";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Primer paso para recuperar la contraseña: pedir el mail con el link.
 *
 * El backend contesta lo mismo exista o no la cuenta, así que esta pantalla tampoco
 * dice si el email estaba registrado: si lo dijera, sería una forma cómoda de
 * averiguar quién tiene cuenta acá.
 */
export function RecoverPassword() {
  const logo = useLogo();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();

    const clean = email.trim();
    if (!clean) return setError("Falta el email");
    if (!EMAIL_REGEX.test(clean)) return setError("Formato de email inválido. Debe incluir @ y un punto");

    setError(null);
    setSending(true);

    api
      .post(`people/${encodeURIComponent(clean)}/passwordMail`)
      .then(() => setSentTo(clean))
      .catch((err) => setError(err.response?.data?.message || "Error al enviar el mail. Reintentar en unos minutos"))
      .finally(() => setSending(false));
  }

  if (sentTo) {
    return (
      <div className="pw-page">
        <div className="pw-card">
          <div className="pw-result">
            <span className="pw-result-icon">
              <FaEnvelopeCircleCheck />
            </span>
            <h1 className="pw-result-title">Revisar el correo</h1>
            <p className="pw-result-text">
              Si existe una cuenta con <span className="pw-result-mail">{sentTo}</span>, llega un link para elegir una
              contraseña nueva. Vence en 30 minutos.
            </p>
            <p className="pw-result-text">Si no aparece, revisar la carpeta de correo no deseado antes de pedir otro.</p>

            <div className="pw-result-actions">
              <Link className="adm-btn adm-btn-primary" to="/Login">
                Volver a iniciar sesión
              </Link>
              <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setSentTo(null)}>
                Usar otro email
              </button>
            </div>
          </div>
        </div>

        <Toasts />
      </div>
    );
  }

  return (
    <div className="pw-page">
      {/* noValidate: los mensajes los damos nosotros, no el globito del navegador. */}
      <form className="pw-card" onSubmit={submit} noValidate>
        <div className="pw-head">
          <img src={logo} alt="Consultorios del Jardín" className="pw-logo" />
          <h1 className="pw-title">Recuperar contraseña</h1>
          <p className="pw-subtitle">Llega un link por mail para elegir una nueva.</p>
        </div>

        <div className="pw-body">
          <label className="ui-field">
            <span>Email</span>
            <div className="pw-input-wrap">
              <input
                autoFocus
                type="email"
                autoComplete="username"
                placeholder="nombre@mail.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
              />
            </div>
          </label>

          {error && <p className="ui-alert ui-alert-error">{error}</p>}
        </div>

        <button type="submit" className="adm-btn adm-btn-primary pw-submit" disabled={sending}>
          {sending ? "Enviando…" : "Enviar link"}
        </button>

        <p className="pw-foot">
          <Link to="/Login">Volver a iniciar sesión</Link>
        </p>
      </form>

      <Toasts />
    </div>
  );
}
