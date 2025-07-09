import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { DataInput } from "../components/DataInput";
import { faGreaterThan } from "@fortawesome/free-solid-svg-icons";



export function Login() {
    return (
        <div className="user-register-container">
    
            <div className='register-title'>
                <FontAwesomeIcon className="title-icon" icon={faGreaterThan} />
                <h1 className='title-text'>Inicio de sesión</h1>
            </div>
            <div className='register-body'>
                <div className='register-body-left'>
                    <DataInput label="Email" type="email"/>
                    <DataInput label="Contraseña" type="password"/>
                    </div>

                <div className='register-body-right'>
                    <div className='logo-consultorios'><img src="/assets/Logo.png" alt="Logo"/></div>
                    <button className='register-button'>Registrar</button>
                </div>
            </div>
            
        </div> 
    );}

    