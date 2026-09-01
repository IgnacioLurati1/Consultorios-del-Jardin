import { DataInput } from "../../components/inputs/standardTextInput/DataInput";
import { Toasts } from "../../components/toast/Toasts.tsx";
import { Link } from "react-router-dom";
import "./RecoverPassword.css";
import Logo from "../../assets/LogoRecortado.png";
import { faGreaterThan } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import api from "../../axios.ts";
import { toast } from "react-toastify"
import { useState } from "react";

async function sendEmail(email: string) {

  api.post(`people/${email}/passwordMail`)
  .then(_ => {
    toast.success("Te mandamos un email, revisá tu bandeja de entrada")
  })
  .catch(error => {
    toast.error(error.message)
  })
}

export function RecoverPassword() {

  const [email, setEmail] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value);
  }

  return (
    <div className="recoverPassword-container">
      <div className="recoverPassword-title">
        <FontAwesomeIcon className="title-icon" icon={faGreaterThan} />
        <h1 className="title-text">Recuperar contraseña</h1>
      </div>

      <div className="recoverPassword-body">
        <div className="recoverPassword-upper">
          <DataInput label="Ingrese su email para recuperar contraseña" type="email" value={email} onChange={handleChange} />
        </div>

        <hr className="divider" />

        <div className="recoverPassword-body-middle">
          <p className="no-account">
            ¿Ya tenés cuenta?{" "}
            <Link to="/Login" className="register-link">
              Volver a iniciar sesión
            </Link>
          </p>
        </div>

        <div className="recoverPassword-lower">
          <div className="recoverPassword-logo-consultorios">
            <img src={Logo} alt="Logo" />
          </div>

          <div className="recoverPassword-button-container">
            <button
              className="recoverPassword-button"
              onClick={() => sendEmail(email)}
            >
              Enviar instrucciones
            </button>
          </div>
        </div>
      </div>
      <Toasts />
    </div>
  );
}