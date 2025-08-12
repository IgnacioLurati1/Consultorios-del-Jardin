import { useState } from "react";
import "./NewPassword.css";
import Logo from '../../assets/LogoRecortado.png';
import { faGreaterThan } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { DataInputPassword } from "../../components/inputs/passwordInput/DataInputPassword";

export function NewPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = () => {
    console.log("Contraseña confirmada:", newPassword);
  };

  return (
    <div className="newPassword-container">
      <div className='newPassword-title'>
        <FontAwesomeIcon className="title-icon" icon={faGreaterThan} />
        <h1 className='title-text'>Nueva contraseña</h1>
      </div>

      <div className='newPassword-body'>
        <div className='newPassword-upper'>

          <div className="newPassword-input-group">
            <DataInputPassword
              label="Ingrese su nueva contraseña"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div className="newPassword-input-group">
            <DataInputPassword
              label="Confirme su nueva contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

        </div>

        <hr className="divider" />

        <div className='newPassword-lower'>
          <div className='newPassword-logo-consultorios'>
            <img src={Logo} alt="Logo" />
          </div>
          <div className="newPassword-button-container">
            <button
              className='newPassword-button'
              onClick={handleSubmit}
              disabled={!passwordsMatch}
            >
              Confirmar contraseña
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
