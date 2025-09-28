import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import axios from "axios";
import { useState } from "react";

export function LoginRegister() {
  const { token, logout } = useAuth();

  const handleLogout = () => {
    logout();
    axios.post("api/people/logout", {}, { withCredentials: true });
    setSureLogOut(false);
  };
  const [sureLogOut, setSureLogOut] = useState(false);

  return (
    <div className="login-register">
      {token ? (
        <button className="login-out button-right" onClick={() => setSureLogOut(true)}>
          Cerrar sesión
        </button>
      ) : (
        <>
          <Link to={"/login"}>
            <button className="login button-right">Iniciar Sesión</button>
          </Link>
          <Link to={"/register"}>
            <button className="register button-right">Registrarse</button>
          </Link>
        </>
      )}

      <div className={`logout-confirmation ${sureLogOut ? "visible" : ""}`} onClick={() => setSureLogOut(false)}>
        <div className="logout-content" onClick={(e) => e.stopPropagation()}>
          <p>¿Está seguro de que desea cerrar sesión?</p>
          <div className="logout-buttons">
            <button className="confirm-logout-button button-right" onClick={handleLogout}>
              Sí
            </button>
            <button className="cancel-logout-button button-right" onClick={() => setSureLogOut(false)}>
              No
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
