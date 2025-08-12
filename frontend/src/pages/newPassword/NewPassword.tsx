import { useState } from "react";
import { ShowPassword } from "../../components/inputs/passwordInput/ShowPassword";
import "./NewPassword.css";
import Logo from '../../assets/LogoRecortado.png';
import { faGreaterThan } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export function NewPassword() {
  const [showPassword1, setShowPassword1] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);

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
            <div className="data-input-container">
              <label className="data-input-label">Ingrese su nueva contraseña</label>
              <input
                type={showPassword1 ? "text" : "password"}
                className="data-input-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <ShowPassword
              visible={showPassword1}
              onClick={() => setShowPassword1(!showPassword1)}
            />
          </div>

          <div className="newPassword-input-group">
            <div className="data-input-container">
              <label className="data-input-label">Confirme su nueva contraseña</label>
              <input
                type={showPassword2 ? "text" : "password"}
                className="data-input-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <ShowPassword
              visible={showPassword2}
              onClick={() => setShowPassword2(!showPassword2)}
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
