import { DataInput } from "../../components/inputs/standardTextInput/DataInput";
import { useNavigate, Link } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import "./Login.css";
import Logo from "../../assets/LogoRecortado.png";
import { faGreaterThan } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { DataInputPassword } from "../../components/inputs/passwordInput/DataInputPassword";
import { useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import type { TokenPayload } from "../types.ts";

export function Login() {
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    contraseña: "",
  });

  const navigate = useNavigate();

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    toast.dismiss(); // Limpia notificaciones previas

    // Validaciones mínimas (También se tiene que hacer en el backend)
    if (!formData.email || !formData.contraseña) {
      toast.error("Complete todos los campos requeridos", {
        className: "feedBack-box error",
      });
      return;
    }

    axios
      .post(
        "api/people/login",
        {
          email: formData.email,
          password: formData.contraseña,
        },
        {
          withCredentials: true, // sin esto, no se envía ni se recibe la cookie
        }
      )
      .then((response) => {
        if (response.data.token) {
          localStorage.setItem("token", response.data.token);
          toast.success("Inicio de sesión exitoso", {
            className: "feedBack-box success",
          });

          const decoded: TokenPayload = jwtDecode(response.data.token);

          login(response.data.token);

          if (decoded.type === "admin") {
            navigate("/adminHome");
          } else if (decoded.type === "professional") {
            navigate("/professionalHome");
          }
        } else {
          navigate("/");
        }
      })
      .catch((error) => {
        console.error("Login error:", error);
        toast.error("Error en el inicio de sesión", {
          className: "feedBack-box error",
        });
      });
  };

  return (
    <div className="user-login-container">
      <form onSubmit={handleSubmit} className="login-form">
        <div className="login-title">
          <FontAwesomeIcon className="title-icon" icon={faGreaterThan} />
          <h1 className="title-text">Inicio de sesión</h1>
        </div>

        <div className="login-body">
          <div className="login-body-upper">
            <DataInput label="Email" type="email" value={formData.email} onChange={(e) => handleChange("email", e.target.value)} />
            <DataInputPassword
              label="Contraseña"
              showForgotPasswordLink={true}
              value={formData.contraseña}
              onChange={(e) => handleChange("contraseña", e.target.value)}
            />
          </div>
          <hr className="divider"></hr>

          <div className="login-body-middle">
            <div>
              <p className="no-account">
                ¿No tienes cuenta?{" "}
                <Link to="/Register" className="register-link">
                  Registrate
                </Link>
              </p>
            </div>
          </div>

          <div className="login-body-lower">
            <div className="login-logo-consultorios">
              <img src={Logo} alt="Logo" />
            </div>
            <div className="login-button-container">
              <button className="login-button">Iniciar sesión</button>
            </div>
          </div>
        </div>

        <div className="toast-container">
          <ToastContainer position="bottom-right" closeOnClick={false} draggable={false} />
        </div>
      </form>
    </div>
  );
}
