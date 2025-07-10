import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { DataInput } from "../components/DataInput";
import { faGreaterThan, faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { Link } from "react-router-dom";
import { useState } from "react";
import "../styles/Login.css";
import Logo from '../assets/LogoRecortado.png';


export function Login() {

    const [visible, setVisible] = useState(false);

    return (
        <div className="user-login-container">
    
            <div className='login-title'>
                <FontAwesomeIcon className="title-icon" icon={faGreaterThan} />
                <h1 className='title-text'>Inicio de sesión</h1>
            </div>

            <div className='login-body'>

                <div className='login-body-upper'>

                    <DataInput label="Email" type="email"/>
                    <DataInput label="Contraseña" type="password"/>

                    <div className="password-options">
                        <Link to='/' className="forgot-password">¿Olvidaste tu contraseña?</Link>  
                        
                        <div className="show-password-wrapper" onClick={() => setVisible((v) => !v)}>
                            <label className="show-password">Mostrar contraseña</label>
                            <FontAwesomeIcon className="eye-icon" icon={visible ? faEyeSlash : faEye} />
                        </div>
                    </div>

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
            
        </div> 
    );}

    