import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { FaCircleCheck, FaEye, FaEyeSlash, FaRegCircle, FaTriangleExclamation } from "react-icons/fa6";
import { Toasts } from "../../components/toast/Toasts.tsx";
import { EntranceBackdrop } from "../../components/entrance/EntranceBackdrop";
import { WelcomeTour } from "./WelcomeTour";
import { API_BASE_URL } from "../../axios.ts";
import { useAuth } from "../../context/AuthContext";
import { useLogo } from "../../lib/useLogo";
import "../newPassword/passwordPages.css";
import "./welcome.css";

/** Mismo mínimo que pide el registro. */
const MIN_PASSWORD = 6;

type Stage = "checking" | "form" | "tour";

interface Problem {
  title: string;
  text: string;
  /** El link ya se usó, así que la contraseña existe y lo que corresponde es entrar. */
  used?: boolean;
}

/**
 * El primer ingreso del profesional.
 *
 * La cuenta se la crea el administrador, que ya no le elige contraseña: elige la suya acá,
 * con el link que le llegó por mail. Abrir el link no gasta nada —se puede cerrar y volver
 * las veces que haga falta—; lo que lo apaga es guardar la contraseña.
 *
 * Después de guardarla no entra directo al panel: el negro tapa la pantalla, saluda, y el
 * asistente le cuenta el panel antes de dejarlo adentro (ver WelcomeTour). El formulario
 * se queda debajo del negro hasta el final, así el cambio de pantalla nunca se ve.
 *
 * No va por `api`: su interceptor manda el token de la sesión, y acá todavía no hay
 * sesión. La dirección del backend sí es la misma, así que sale de la constante compartida.
 */
export function Welcome() {
  const logo = useLogo();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [params] = useSearchParams();
  const token = params.get("token");

  const [stage, setStage] = useState<Stage>("checking");
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<Problem | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preguntar primero si el link sirve evita lo peor de esta pantalla: elegir una
  // contraseña, apretar el botón y ahí enterarse de que el link ya no valía.
  const preguntado = useRef(false);

  useEffect(() => {
    if (!token || preguntado.current) return;
    preguntado.current = true;

    axios
      .post(`${API_BASE_URL}/people/welcome/check`, { token })
      .then((response) => {
        setName(response.data?.data?.name ?? "");
        setStage("form");
      })
      .catch((err) => {
        const code = err.response?.data?.code;
        setProblem({
          title: code === "WELCOME_LINK_USED" ? "Este link ya se usó" : "El link no sirve más",
          text:
            err.response?.data?.message ??
            "No pudimos abrir el link. Probá de nuevo en un rato, o pedí una contraseña nueva con este mismo email.",
          used: code === "WELCOME_LINK_USED",
        });
      });
  }, [token]);

  const rules = [
    { label: `Al menos ${MIN_PASSWORD} caracteres`, done: password.length >= MIN_PASSWORD },
    { label: "Las dos coinciden", done: password.length > 0 && password === confirm },
  ];
  const ready = rules.every((rule) => rule.done);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || !token || saving) return;

    setError(null);
    setSaving(true);

    axios
      .post(`${API_BASE_URL}/people/welcome`, { token, password })
      .then((response) => {
        // Entra sin volver a escribirla: la acaba de elegir hace un segundo.
        if (response.data.token) login(response.data.token);
        setStage("tour");
      })
      .catch((err) => setError(err.response?.data?.message || "No pudimos guardar la contraseña. Probá de nuevo en un rato"))
      .finally(() => setSaving(false));
  }

  const entrar = useCallback(() => navigate("/ProfessionalHome"), [navigate]);

  // Entrar a mano acá, o con un link que el cliente de correo cortó al medio.
  if (!token) return <Aviso title="Link incompleto" text="Parte del link se perdió, probablemente al copiarlo desde el mail." />;

  if (problem)
    return (
      <Aviso
        title={problem.title}
        text={problem.text}
        action={
          problem.used ? { label: "Iniciar sesión", to: "/Login" } : { label: "Pedir una contraseña nueva", to: "/forgot-password" }
        }
      />
    );

  if (stage === "checking")
    return (
      <div className="pw-page">
        <div className="pw-card">
          <p className="pw-result-text">Abriendo tu link…</p>
        </div>
      </div>
    );

  // La pantalla en la que elige la contraseña. Queda abajo mientras el negro la tapa: el
  // cambio pasa detrás, y a la vista solo hay un fundido.
  const formulario = (
    <div className="pw-page entrance-host">
      <EntranceBackdrop />

      <form className="pw-card" onSubmit={submit} noValidate>
        <div className="pw-head">
          <img src={logo} alt="Consultorios del Jardín" className="pw-logo" />
          <h1 className="pw-title">{name ? `Hola, ${name}` : "Creá tu contraseña"}</h1>
          <p className="pw-subtitle">Elegí la contraseña con la que vas a entrar. Es el último paso para abrir tu cuenta.</p>
        </div>

        <div className="pw-body">
          <label className="ui-field">
            <span>Contraseña</span>
            <div className="pw-input-wrap">
              <input
                autoFocus
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
              />
              <button
                type="button"
                className="pw-input-toggle"
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? "Ocultar" : "Mostrar"}
              >
                {visible ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </label>

          <label className="ui-field">
            <span>Repetir contraseña</span>
            <div className="pw-input-wrap">
              <input
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setError(null);
                }}
              />
            </div>
          </label>

          <ul className="pw-rules">
            {rules.map((rule) => (
              <li key={rule.label} className={`pw-rule ${rule.done ? "done" : ""}`}>
                {rule.done ? <FaCircleCheck /> : <FaRegCircle />}
                {rule.label}
              </li>
            ))}
          </ul>

          {error && <p className="ui-alert ui-alert-error">{error}</p>}
        </div>

        <button type="submit" className="adm-btn adm-btn-primary pw-submit" disabled={!ready || saving}>
          {saving ? "Guardando…" : "Guardar y entrar"}
        </button>

        <p className="pw-foot">Podés cerrar esta página y volver al link. Se apaga recién cuando guardás la contraseña.</p>
      </form>

      <Toasts />
    </div>
  );

  if (stage === "tour")
    return (
      <>
        {formulario}

        {/* Afuera del contenedor del hall a propósito: ese aísla sus capas, y desde adentro
            el negro no podría taparle la barra de arriba ni el globo del asistente. */}
        <WelcomeTour name={name} onFinish={entrar} />
      </>
    );

  return formulario;
}

/** Los finales malos del link, todos con la misma cara. */
function Aviso({ title, text, action }: { title: string; text: string; action?: { label: string; to: string } }) {
  return (
    <div className="pw-page">
      <div className="pw-card">
        <div className="pw-result">
          <span className="pw-result-icon warn">
            <FaTriangleExclamation />
          </span>
          <h1 className="pw-result-title">{title}</h1>
          <p className="pw-result-text">{text}</p>
          <div className="pw-result-actions">
            <Link className="adm-btn adm-btn-primary" to={action?.to ?? "/Login"}>
              {action?.label ?? "Iniciar sesión"}
            </Link>
          </div>
        </div>
      </div>
      <Toasts />
    </div>
  );
}
