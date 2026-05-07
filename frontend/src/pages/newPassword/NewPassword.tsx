import { useState, useEffect } from "react";
import "./NewPassword.css";
import Logo from "../../assets/LogoRecortado.png";
import { faGreaterThan } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { DataInputPassword } from "../../components/inputs/passwordInput/DataInputPassword";
import { useLocation } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";

export function NewPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const { search } = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(search);
    const token = params.get("token");
    console.log(token);

    if (!token) return;
    localStorage.setItem("tokenTemp", token);
  }, [search]);

  async function handleSubmit() {
    const token = localStorage.getItem("tokenTemp");

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/people/changePassword`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          password: newPassword,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Error en la request");
      }

      toast.success("Contraseña cambiada");
      localStorage.removeItem("tokenTemp");
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  return (
    <div className="newPassword-container">
      <div className="newPassword-title">
        <FontAwesomeIcon className="title-icon" icon={faGreaterThan} />
        <h1 className="title-text">Nueva contraseña</h1>
      </div>

      <div className="newPassword-body">
        <div className="newPassword-upper">
          <div className="newPassword-input-group">
            <DataInputPassword label="Ingrese su nueva contraseña" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
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

        <div className="newPassword-lower">
          <div className="newPassword-logo-consultorios">
            <img src={Logo} alt="Logo" />
          </div>
          <div className="newPassword-button-container">
            <button className="newPassword-button" onClick={handleSubmit} disabled={!passwordsMatch}>
              Confirmar contraseña
            </button>
          </div>
        </div>
      </div>
      <ToastContainer className="feedBack-box"
          closeOnClick={false}
          draggable={false}
          toastClassName="feedBack-box"
        />
    </div>
  );
}