import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { DataInput } from "../components/DataInput";
import { faGreaterThan } from "@fortawesome/free-solid-svg-icons";
import "../styles/Login.css";
import Logo from '../assets/Logo.png';



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
                    <DataInput label="Contraseña" type="password"/>
                </div>

                <div className='login-body-lower'>
                    <div className='login-logo-consultorios'><img src={Logo} alt="Logo"/></div>
                    <div className="login-button-container"><button className='login-button'>Iniciar sesión</button></div>
                </div>

            </div>
            
        </div> 
    );}

    