import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Toasts } from "../../../components/toast/Toasts.tsx";
import { SteppedForm, type FormStep } from "../../../components/steppedForm/SteppedForm.tsx";
import { registerProfessional } from "./usersService";
import { useLogo } from "../../../lib/useLogo";
import { subirAlPrincipio } from "../../../lib/scroll";
import {
  DOC_TYPES,
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
  const logo = useLogo();
  const navigate = useNavigate();

  const [form, setForm] = useState<RegisterForm>(emptyRegisterForm);
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
      speciality: form.speciality.trim(),
      about: form.about.trim() || undefined,
    })
      .then(() => {
        toast.success("Profesional registrado. Le mandamos un mail para que cree su contraseña");
        navigate("/AdminHome/UsersAdmin");
        subirAlPrincipio();
      })
      .catch((err: Error) => {
        setServerError(err.message || "Error al registrar al profesional");
        setSending(false);
      });
  }

  const steps: FormStep[] = [
    {
      id: "cuenta",
      title: "Cuenta",
      hint: "Al profesional le llega un mail para que cree su contraseña y entre por primera vez.",
      validate: () => validateAccountAsync(form, { password: false }),
      content: (
        <label className="ui-field">
          <span>Email</span>
          <input type="email" placeholder="profesional@mail.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
          <small>Ahí le llega el link para crear su contraseña, así que conviene revisarlo dos veces.</small>
        </label>
      ),
    },
    {
      id: "datos",
      title: "Datos",
      hint: "Nombre visible para los pacientes al solicitar turno.",
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
              <option value="">Seleccionar…</option>
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
              placeholder="Áreas de trabajo, enfoque, población que se atiende…"
              value={form.about}
              onChange={(e) => set("about", e.target.value)}
            />
            <small>
              Opcional. Visible para el paciente al elegir profesional. {form.about.length}/{ABOUT_MAX}
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
                <option value="">Seleccionar…</option>
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
        subtitle="Queda habilitado para atender apenas se guarda. La contraseña la elige el profesional desde su mail"
        logo={logo}
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
