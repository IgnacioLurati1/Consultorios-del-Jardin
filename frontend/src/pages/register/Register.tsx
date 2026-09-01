import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FaEye, FaEyeSlash } from "react-icons/fa6";
import { Toasts } from "../../components/toast/Toasts.tsx";
import { SteppedForm, type FormStep } from "../../components/steppedForm/SteppedForm.tsx";
import { useAuth } from "../../context/AuthContext";
import api from "../../axios";
import Logo from "../../assets/LogoRecortado.png";
import {
  DOC_TYPES,
  MIN_PASSWORD,
  emptyRegisterForm,
  validateAccountAsync,
  validateContact,
  validatePersonalData,
  type RegisterForm,
} from "./registerFields.ts";

export function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<RegisterForm>(emptyRegisterForm);
  const [showPassword, setShowPassword] = useState(false);
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const set = (field: keyof RegisterForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setServerError(null);
  };

  function handleSubmit() {
    toast.dismiss();
    setSending(true);

    api
      .post(
        "/people",
        {
          name: form.name.trim(),
          surname: form.surname.trim(),
          email: form.email.trim(),
          docType: form.docType,
          docNumber: form.docNumber.trim(),
          phoneNumber: form.phoneNumber.replace(/\D/g, ""),
          password: form.password,
          type: "client",
        },
        { withCredentials: true } // sin esto no se recibe la cookie del refresh token
      )
      .then((response) => {
        // El alta ya devuelve el token de sesión: no hace falta un login aparte.
        if (!response.data.token) {
          navigate("/Login");
          return;
        }

        login(response.data.token);
        toast.success("¡Listo! Ya tenés cuenta");
        navigate("/");
        window.scrollTo(0, 0);
      })
      .catch((error) => {
        const backendMsg = error.response?.data?.message || error.message || "No pudimos crear tu cuenta";
        setServerError(backendMsg);
        setSending(false);
      });
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

  return (
    <>
      <SteppedForm
        title="Crear cuenta"
        subtitle="Tres pasos cortos y ya podés pedir turno"
        logo={Logo}
        steps={steps}
        submitLabel="Crear cuenta"
        submitting={sending}
        serverError={serverError}
        onSubmit={handleSubmit}
        footerNote={<>¿Ya tenés cuenta? <Link to="/Login">Iniciá sesión</Link></>}
      />
      <Toasts />
    </>
  );
}
