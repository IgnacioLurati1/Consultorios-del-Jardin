import { useState } from "react";
import { Link } from "react-router-dom";
import { FaEnvelopeOpenText, FaEye, FaEyeSlash } from "react-icons/fa6";
import { Toasts } from "../../components/toast/Toasts.tsx";
import { SteppedForm, type FormStep } from "../../components/steppedForm/SteppedForm.tsx";
import api from "../../axios";
import { useLogo } from "../../lib/useLogo";
import {
  DOC_TYPES,
  MIN_PASSWORD,
  emptyRegisterForm,
  validateAccountAsync,
  validateContact,
  validatePersonalData,
  type RegisterForm,
} from "./registerFields.ts";
// La pantalla de "mirá tu correo" usa la misma caja centrada que las de contraseña: es el
// mismo momento del circuito —te mandamos un link, andá a buscarlo— y tiene que verse igual.
import "../newPassword/passwordPages.css";

/**
 * Alta de un paciente.
 *
 * El formulario no crea la cuenta: pide el mail que la crea. La dirección es por donde le
 * van a llegar la confirmación del turno y el recordatorio del día anterior, así que una
 * cuenta con el mail mal escrito es una persona que nunca se entera de nada y un turno que
 * nadie sabe si sigue en pie. El paso de más existe para que eso no pase.
 *
 * Es el único circuito que lo pide. El profesional no se registra solo —lo carga el
 * administrador— y el paciente sin cuenta lo carga el profesional, con la dirección que le
 * dictaron en el mostrador.
 */
export function Register() {
  const logo = useLogo();

  const [form, setForm] = useState<RegisterForm>(emptyRegisterForm);
  const [showPassword, setShowPassword] = useState(false);
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  // Con el mail ya mandado la pantalla cambia entera: lo que sigue no se hace acá.
  const [sent, setSent] = useState(false);

  const set = (field: keyof RegisterForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setServerError(null);
  };

  function handleSubmit() {
    setSending(true);

    api
      .post("/people/signup", {
        name: form.name.trim(),
        surname: form.surname.trim(),
        email: form.email.trim(),
        docType: form.docType,
        docNumber: form.docNumber.trim(),
        phoneNumber: form.phoneNumber.replace(/\D/g, ""),
        password: form.password,
        type: "client",
      })
      .then(() => setSent(true))
      .catch((error) => {
        const backendMsg = error.response?.data?.message || error.message || "No pudimos mandarte el mail";
        setServerError(backendMsg);
      })
      .finally(() => setSending(false));
  }

  const steps: FormStep[] = [
    {
      id: "cuenta",
      title: "Cuenta",
      hint: "Con estos datos vas a entrar a la app.",
      validate: () => validateAccountAsync(form),
      content: (
        <>
          <label className="ui-field">
            <span>Email</span>
            <input type="email" placeholder="vos@mail.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </label>

          <label className="ui-field">
            <span>Contraseña</span>
            <div className="sf-input-wrap">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
              />
              <button
                type="button"
                className="sf-input-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar" : "Mostrar"}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            <small>Al menos {MIN_PASSWORD} caracteres.</small>
          </label>

          <label className="ui-field">
            <span>Repetir contraseña</span>
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) => set("confirmPassword", e.target.value)}
            />
          </label>
        </>
      ),
    },
    {
      id: "datos",
      title: "Datos",
      hint: "Así te identifica el profesional cuando te da un turno.",
      validate: () => validatePersonalData(form),
      content: (
        <div className="ui-field-row">
          <label className="ui-field">
            <span>Nombre</span>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </label>
          <label className="ui-field">
            <span>Apellido</span>
            <input value={form.surname} onChange={(e) => set("surname", e.target.value)} />
          </label>
        </div>
      ),
    },
    {
      id: "contacto",
      title: "Contacto",
      hint: "Lo usamos para avisarte de tus turnos.",
      validate: () => validateContact(form),
      content: (
        <>
          <label className="ui-field">
            <span>Teléfono</span>
            <input placeholder="3411234567" value={form.phoneNumber} onChange={(e) => set("phoneNumber", e.target.value)} />
          </label>

          <div className="ui-field-row">
            <label className="ui-field">
              <span>Tipo de documento</span>
              <select value={form.docType} onChange={(e) => set("docType", e.target.value)}>
                <option value="">Elegí uno…</option>
                {DOC_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="ui-field">
              <span>Número de documento</span>
              <input value={form.docNumber} onChange={(e) => set("docNumber", e.target.value)} />
            </label>
          </div>
        </>
      ),
    },
  ];

  /*
   * Lo que se ve después de pedir el mail.
   *
   * No dice si esa dirección ya tenía cuenta, y es a propósito: el servidor contesta lo
   * mismo en los dos casos para que esta pantalla no sirva para averiguar quién está
   * registrado. Quien ya tenía cuenta no recibe nada y entra por "Iniciar sesión", que
   * está ahí abajo.
   */
  if (sent) {
    return (
      <>
        <div className="pw-page">
          <div className="pw-card">
            <div className="pw-result">
              <span className="pw-result-icon">
                <FaEnvelopeOpenText />
              </span>
              <h1 className="pw-result-title">Mirá tu correo</h1>
              <p className="pw-result-text">
                Le escribimos a <strong>{form.email.trim()}</strong>. Adentro hay un link que crea la cuenta y te deja
                adentro. Vence en 30 minutos.
              </p>
              <p className="pw-result-text">Si no aparece, fijate en el correo no deseado.</p>
              <div className="pw-result-actions">
                <Link className="adm-btn adm-btn-primary" to="/Login">
                  Ir a iniciar sesión
                </Link>
              </div>
            </div>
          </div>
        </div>
        <Toasts />
      </>
    );
  }

  return (
    <>
      <SteppedForm
        title="Crear cuenta"
        subtitle="Tres pasos cortos y un mail para confirmar que sos vos"
        logo={logo}
        steps={steps}
        submitLabel="Mandarme el mail"
        submitting={sending}
        serverError={serverError}
        onSubmit={handleSubmit}
        footerNote={<>¿Ya tenés cuenta? <Link to="/Login">Iniciá sesión</Link></>}
      />
      <Toasts />
    </>
  );
}
