import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { toast } from "react-toastify";
import { FaEye, FaEyeSlash, FaShieldHalved } from "react-icons/fa6";
import { Toasts } from "../../components/toast/Toasts.tsx";
import { useAuth } from "../../context/AuthContext";
import type { TokenPayload } from "../types.ts";
import { LoginService } from "./loginServices.ts";
import { LOCKOUT_KEY } from "../../axios";
import { useLogo } from "../../lib/useLogo";
import { HolidayGarland } from "../../components/decor/HolidayDecor";
import { EntranceBackdrop } from "../../components/entrance/EntranceBackdrop";
import { backdropOn } from "../../components/entrance/backdropCookie";
import { useDesktop } from "../../components/entrance/useDesktop";
import { wakeNightAudio } from "../../components/entrance/nightAudio";
import "./Login.css";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * La llave del paseo por el hall: con este usuario y esta contraseña, y el fondo prendido,
 * la tarjeta se va y el hall se recorre. No es una cuenta ni llega al servidor; sin el fondo
 * prendido, "blues" no es un email y el formulario lo frena como a cualquier otro.
 */
const WALK_USER = "blues";
const WALK_PASSWORD = "stevie";

/** La otra llave, la de la noche de terror en el mismo hall. Igual que la del paseo. */
const NIGHT_USER = "fnaf";
const NIGHT_PASSWORD = "1987";

const HOME_BY_TYPE: Record<string, string> = {
  admin: "/AdminHome",
  professional: "/ProfessionalHome",
  client: "/",
};

export function Login() {
  const logo = useLogo();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Una cuenta cerrada por seguridad no es un error de tipeo: se cuenta aparte y se ve
  // distinto, porque lo que hay que hacer no es reintentar sino hablar con alguien.
  const [lockout, setLockout] = useState<string | null>(() => {
    try {
      const saved = sessionStorage.getItem(LOCKOUT_KEY);
      if (saved) sessionStorage.removeItem(LOCKOUT_KEY);
      return saved || null;
    } catch {
      return null;
    }
  });
  const [sending, setSending] = useState(false);
  const desktop = useDesktop();
  // "form" es lo de siempre; "walk", paseando por el hall; "night", la noche de terror;
  // "back", la tarjeta volviendo.
  const [phase, setPhase] = useState<"form" | "walk" | "night" | "back">("form");
  const away = phase === "walk" || phase === "night";

  function startWalk(next: "walk" | "night") {
    setPassword("");
    setError(null);
    // Que el foco no quede en un campo oculto: las teclas son para caminar.
    (document.activeElement as HTMLElement | null)?.blur?.();
    // El sonido de la noche solo puede arrancar desde un clic: este es el de "Entrar".
    if (next === "night") wakeNightAudio();
    setPhase(next);
  }

  function validate(): string | null {
    if (!email.trim()) return "Falta el email";
    if (!EMAIL_REGEX.test(email.trim())) return "Formato de email inválido. Debe incluir @ y un punto";
    if (!password) return "Falta la contraseña";
    return null;
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    toast.dismiss();

    const user = email.trim().toLowerCase();
    if (desktop && backdropOn() && user === WALK_USER && password === WALK_PASSWORD) {
      startWalk("walk");
      return;
    }
    if (desktop && backdropOn() && user === NIGHT_USER && password === NIGHT_PASSWORD) {
      startWalk("night");
      return;
    }

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setError(null);
    setLockout(null);
    setSending(true);

    LoginService(email.trim(), password)
      .then((responseData: any) => {
        if (!responseData.token) {
          navigate("/");
          return;
        }

        const decoded: TokenPayload = jwtDecode(responseData.token);
        login(responseData.token);
        navigate(HOME_BY_TYPE[decoded.type] ?? "/");
      })
      .catch((err: any) => {
        if (err.code === "ACCOUNT_COMPROMISED") setLockout(err.message);
        else setError(err.message || "Error al iniciar sesión");

        setSending(false);
      });
  }

  return (
    <div className={`login-page entrance-host ${away ? "is-walking" : ""} ${phase === "night" ? "is-night" : ""}`}>
      <EntranceBackdrop
        mode={phase === "walk" || phase === "night" ? phase : undefined}
        onLeave={() => setPhase("back")}
      />
      <HolidayGarland compact />

      {/* noValidate: la validación nativa del navegador bloquearía el submit antes de
          llegar acá y mostraría su propio globito. Los mensajes los damos nosotros. */}
      <form
        className={`login-card ${away ? "is-away" : phase === "back" ? "is-back" : ""}`}
        onSubmit={submit}
        noValidate
        aria-hidden={away || undefined}
      >
        <div className="login-card-head">
          <img src={logo} alt="Consultorios del Jardín" className="login-logo" />
          <h1 className="login-title">Iniciar sesión</h1>
          <p className="login-subtitle">Con email y contraseña</p>
        </div>

        <div className="login-body">
          <label className="ui-field">
            <span>Email</span>
            <div className="login-input-wrap">
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

          <label className="ui-field">
            <span>Contraseña</span>
            <div className="login-input-wrap">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
              />
              <button
                type="button"
                className="login-input-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar" : "Mostrar"}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </label>

          <Link className="login-forgot" to="/forgot-password">
            Recuperar contraseña
          </Link>

          {lockout && (
            <div className="login-lockout" role="alert">
              <FaShieldHalved aria-hidden="true" />
              <div>
                <strong>Cuenta cerrada por seguridad</strong>
                <p>{lockout}</p>
                {/* La ruta es /contacto: con /contact el link caía en la página de no encontrada. */}
                <Link to="/contacto">Contactar al consultorio</Link>
              </div>
            </div>
          )}

          {error && <p className="ui-alert ui-alert-error">{error}</p>}
        </div>

        <button type="submit" className="adm-btn adm-btn-primary login-submit" disabled={sending}>
          {sending ? "Entrando…" : "Entrar"}
        </button>

        <p className="login-register-line">
          ¿Primera vez? <Link to="/Register">Crear cuenta</Link>
        </p>
      </form>

      <Toasts />
    </div>
  );
}
