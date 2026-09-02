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
import "./Login.css";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  function validate(): string | null {
    if (!email.trim()) return "Escribí tu email";
    if (!EMAIL_REGEX.test(email.trim())) return "Ese email no parece válido. Revisá que tenga @ y un punto";
    if (!password) return "Escribí tu contraseña";
    return null;
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    toast.dismiss();

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
        else setError(err.message || "No pudimos iniciar tu sesión");

        setSending(false);
      });
  }

  return (
    <div className="login-page">
      {/* noValidate: la validación nativa del navegador bloquearía el submit antes de
          llegar acá y mostraría su propio globito. Los mensajes los damos nosotros. */}
      <form className="login-card" onSubmit={submit} noValidate>
        <div className="login-card-head">
          <img src={logo} alt="Consultorios del Jardín" className="login-logo" />
          <h1 className="login-title">Iniciar sesión</h1>
          <p className="login-subtitle">Entrá con tu email y tu contraseña</p>
        </div>

        <div className="login-body">
          <label className="ui-field">
            <span>Email</span>
            <div className="login-input-wrap">
              <input
                autoFocus
                type="email"
                autoComplete="username"
                placeholder="vos@mail.com"
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
                placeholder="Tu contraseña"
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
            ¿Olvidaste tu contraseña?
          </Link>

          {lockout && (
            <div className="login-lockout" role="alert">
              <FaShieldHalved aria-hidden="true" />
              <div>
                <strong>Cuenta cerrada por seguridad</strong>
                <p>{lockout}</p>
                <Link to="/contact">Escribirle al consultorio</Link>
              </div>
            </div>
          )}

          {error && <p className="ui-alert ui-alert-error">{error}</p>}
        </div>

        <button type="submit" className="adm-btn adm-btn-primary login-submit" disabled={sending}>
          {sending ? "Entrando…" : "Entrar"}
        </button>

        <p className="login-register-line">
          ¿No tenés cuenta? <Link to="/Register">Registrate</Link>
        </p>
      </form>

      <Toasts />
    </div>
  );
}
