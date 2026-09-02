import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FaEye, FaEyeSlash } from "react-icons/fa6";
import { Toasts } from "../../../components/toast/Toasts.tsx";
import { SteppedForm, type FormStep } from "../../../components/steppedForm/SteppedForm.tsx";
import { registerProfessional } from "./usersService";
import Logo from "../../../assets/LogoRecortado.png";
import {
  DOC_TYPES,
  MIN_PASSWORD,
  emptyRegisterForm,
  validateAccountAsync,
  validateContact,
  validatePersonalData,
  type RegisterForm,
} from "../../register/registerFields.ts";
import { SPECIALITIES } from "../../specialities.ts";

/** El mismo tope que valida el backend. */
const ABOUT_MAX = 600;

export function RegisterProf() {
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

    registerProfessional({
      name: form.name.trim(),
      surname: form.surname.trim(),
      email: form.email.trim(),
      docType: form.docType,
      docNumber: form.docNumber.trim(),
      phoneNumber: form.phoneNumber.replace(/\D/g, ""),
      password: form.password,
      speciality: form.speciality.trim(),
      about: form.about.trim() || undefined,
    })
      .then(() => {
        toast.success("Profesional registrado");
        navigate("/AdminHome/UsersAdmin");
        window.scrollTo(0, 0);
      })
      .catch((err: Error) => {
        setServerError(err.message || "No pudimos registrar al profesional");
        setSending(false);
      });
  }

  const steps: FormStep[] = [
    {
      id: "cuenta",
      title: "Cuenta",
      hint: "Con estos datos el profesional va a entrar a la app. Después puede cambiar la contraseña desde su perfil.",
      validate: () => validateAccountAsync(form),
      content: (
        <>
          <label className="ui-field">
            <span>Email</span>
            <input type="email" placeholder="profesional@mail.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
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
      hint: "Es el nombre que van a ver los pacientes al pedir un turno.",
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
      hint: "Los horarios de atención se cargan después, desde la grilla de horarios.",
      validate: () => validateContact(form, { requireSpeciality: true }),
      content: (
        <>
          <label className="ui-field">
            <span>Especialidad</span>
            {/* Lista fija: es la misma con la que el paciente filtra al buscar turno,
                así que escribirla a mano solo abre la puerta a que no coincidan. */}
            <select value={form.speciality} onChange={(e) => set("speciality", e.target.value)}>
              <option value="">Elegí una…</option>
              {SPECIALITIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="ui-field">
            <span>Acerca de mí</span>
            <textarea
              rows={4}
              maxLength={ABOUT_MAX}
              placeholder="Con qué trabaja, con qué enfoque, a quiénes atiende…"
              value={form.about}
              onChange={(e) => set("about", e.target.value)}
            />
            <small>
              Opcional. Es lo que lee el paciente antes de elegir con quién atenderse. {form.about.length}/{ABOUT_MAX}
            </small>
          </label>

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
        title="Registrar profesional"
        subtitle="Queda habilitado para atender apenas se guarda"
        logo={Logo}
        steps={steps}
        submitLabel="Registrar profesional"
        submitting={sending}
        serverError={serverError}
        onSubmit={handleSubmit}
        footerNote={<Link to="/AdminHome/UsersAdmin">Volver al listado de usuarios</Link>}
      />
      <Toasts />
    </>
  );
}
