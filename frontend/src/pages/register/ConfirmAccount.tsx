import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { FaCircleCheck, FaTriangleExclamation } from "react-icons/fa6";
import { Toasts } from "../../components/toast/Toasts.tsx";
import { API_BASE_URL } from "../../axios.ts";
import { useAuth } from "../../context/AuthContext";
import { useLogo } from "../../lib/useLogo";
import { subirAlPrincipio } from "../../lib/scroll";
import "../newPassword/passwordPages.css";

/**
 * El link del mail que termina de crear la cuenta.
 *
 * Trabaja sola: no hay nada que completar acá, porque los datos se cargaron en el registro
 * y viajan firmados adentro del token. Lo único que hace esta pantalla es entregarlo,
 * dejar la sesión abierta y correrse.
 *
 * No va por `api`: su interceptor pone el token de la sesión en el header, y acá todavía
 * no hay sesión. La dirección del backend sí es la misma, así que sale de la constante
 * compartida en vez de estar escrita a mano.
 */
export function ConfirmAccount() {
  const logo = useLogo();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [params] = useSearchParams();
  const token = params.get("token");

  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // React monta dos veces en desarrollo, y esto crea una cuenta: la segunda llamada
  // chocaría contra el email ya tomado y mostraría un error sobre un alta que salió bien.
  const pedido = useRef(false);

  useEffect(() => {
    if (!token || pedido.current) return;
    pedido.current = true;

    axios
      .post(`${API_BASE_URL}/people/signup/confirm`, { token })
      .then((response) => {
        setDone(true);
        if (response.data.token) login(response.data.token);
      })
      .catch((err) =>
        setError(err.response?.data?.message || "No pudimos crear la cuenta. Probá de nuevo en un rato")
      );
  }, [token, login]);

  // Entrar a mano acá, o con un link que el cliente de correo cortó al medio.
  if (!token) {
    return (
      <div className="pw-page">
        <div className="pw-card">
          <div className="pw-result">
            <span className="pw-result-icon warn">
              <FaTriangleExclamation />
            </span>
            <h1 className="pw-result-title">Este link no sirve</h1>
            <p className="pw-result-text">
              Le falta la parte que identifica tu pedido. Puede que se haya cortado al copiarlo desde el mail.
            </p>
            <div className="pw-result-actions">
              <Link className="adm-btn adm-btn-primary" to="/Register">
                Volver a registrarme
              </Link>
            </div>
          </div>
        </div>
        <Toasts />
      </div>
    );
  }

  if (error) {
    return (
      <div className="pw-page">
        <div className="pw-card">
          <div className="pw-result">
            <span className="pw-result-icon warn">
              <FaTriangleExclamation />
            </span>
            <h1 className="pw-result-title">No pudimos crear la cuenta</h1>
            <p className="pw-result-text">{error}</p>
            <div className="pw-result-actions">
              <Link className="adm-btn adm-btn-primary" to="/Register">
                Volver a registrarme
              </Link>
              <Link className="adm-btn adm-btn-ghost" to="/Login">
                Iniciar sesión
              </Link>
            </div>
          </div>
        </div>
        <Toasts />
      </div>
    );
  }

  if (done) {
    return (
      <div className="pw-page">
        <div className="pw-card">
          <div className="pw-result">
            <span className="pw-result-icon">
              <FaCircleCheck />
            </span>
            <h1 className="pw-result-title">Listo, ya tenés cuenta</h1>
            <p className="pw-result-text">Tu dirección quedó confirmada y la sesión abierta. Ya podés pedir turno.</p>
            <div className="pw-result-actions">
              <button
                type="button"
                className="adm-btn adm-btn-primary"
                onClick={() => {
                  navigate("/");
                  subirAlPrincipio();
                }}
              >
                Empezar
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
      <div className="pw-card">
        <div className="pw-head">
          <img src={logo} alt="Consultorios del Jardín" className="pw-logo" />
          <h1 className="pw-title">Creando tu cuenta</h1>
          <p className="pw-subtitle">Un segundo, estamos confirmando tu dirección.</p>
        </div>
      </div>
      <Toasts />
    </div>
  );
}
