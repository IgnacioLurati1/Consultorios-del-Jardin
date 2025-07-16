import { DataInput } from "../components/DataInput";
import { Link } from "react-router-dom";
import "../styles/Login.css";
import Logo from '../assets/LogoRecortado.png';
import { faGreaterThan } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { DataInputPassword } from "../components/DataInputPassword";

export function Login() {

    return (
        <div className="user-login-container">
    
            <div className='login-title'>
                <FontAwesomeIcon className="title-icon" icon={faGreaterThan} />
                <h1 className='title-text'>Inicio de sesión</h1>
            </div>

            <div className='login-body'>

                <div className='login-body-upper'>
                    <DataInput label="Email" type="email"/>
                    <DataInputPassword label="Contraseña" showForgotPasswordLink={true}/> 
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

    