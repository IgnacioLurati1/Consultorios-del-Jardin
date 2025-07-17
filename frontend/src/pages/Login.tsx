import { DataInput } from "../components/DataInput";
import { Link } from "react-router-dom";
import "../styles/Login.css";
import Logo from '../assets/LogoRecortado.png';
import { faGreaterThan } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { DataInputPassword } from "../components/DataInputPassword";
import { useState } from "react";

export function Login() {

const [formData, setFormData] = useState({
        email: '',
        contraseña: ''
    });

const handleChange = (field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.email || !formData.contraseña) {
        console.log("Complete todos los campos requeridos");
        return;
    }

    // Simular envío (Acá va el fetch al backend)
    console.log("Formulario enviado con:", formData);
    console.log("Inicio de sesión exitoso");
};

    return (
        <div className="user-login-container">

            <form onSubmit={handleSubmit} className='login-form'>

                <div className='login-title'>
                    <FontAwesomeIcon className="title-icon" icon={faGreaterThan} />
                    <h1 className='title-text'>Inicio de sesión</h1>
                </div>

                <div className='login-body'>
                    <div className='login-body-upper'>
                        <DataInput label="Email" type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} />
                        <DataInputPassword label="Contraseña" showForgotPasswordLink={true} value={formData.contraseña} onChange={(e) => handleChange('contraseña', e.target.value)} />
                    </div>
                    <hr className="divider"></hr>

                    <div className="login-body-middle">
                        <div>
                            <p className="no-account">¿No tienes cuenta? <Link to='/Register' className="register-link">Registrate</Link></p>
                        </div>
                    </div>

                    <div className='login-body-lower'>
                        <div className='login-logo-consultorios'><img src={Logo} alt="Logo"/></div>
                        <div className="login-button-container"><button className='login-button'>Iniciar sesión</button></div>
                    </div>

                </div>
            
            </form>
        </div> 
    );}