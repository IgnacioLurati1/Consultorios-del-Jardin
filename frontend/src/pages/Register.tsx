import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faGreaterThan} from '@fortawesome/free-solid-svg-icons'
import '../styles/Register.css';
import { DataInput } from '../components/DataInput';
import Logo from '../assets/Logo.png';
import { useState } from "react";

    
export function Register() {

const [activo, setPage] = useState(false);

    const changePage = () => {
        setPage(!activo);
    }

return (
    <div className="user-register-container">

        <div className='register-title'>
            <FontAwesomeIcon className="title-icon" icon={faGreaterThan} />
            <h1 className='title-text'>Registro de Usuario</h1>
        </div>
        <div className='register-body'>
            <div className='register-body-left'>
                <div className={activo? "shown":"not-shown"}>
                <DataInput label="Nombre" type="text"/>
                <DataInput label="Apellido" type="text"/>
                </div>
                <div className={activo? "not-shown":"shown"}>
                    <DataInput label="Email" type="email"/>
                    <DataInput label="Contraseña" type="password"/>
                    <DataInput label="Confirmar contraseña" type="password"/>
                </div>
                <div className={activo? "shown":"not-shown"}>
                <DataInput label="Teléfono" type="text"/>
                <div className='document-dataInput'>
                    <div className='tipoDoc'>
                    <DataInput label="Tipo documento" type="selector" options={["DNI", "Pasaporte", "Cédula de Identidad", "Libreta de Enrolamiento", "Libreta Cívica", "Otro"]}/>
                    </div>
                    <div className='nroDoc'><DataInput label="Nro. documento" type="text"/></div>
                </div>
                </div>
            </div>
            <div className='register-body-right'>
                <div className='logo-consultorios'><img src={Logo} alt="Logo"/></div>
                                <button className={activo? 'register-button next shown': 'register-button next not-shown'} onClick={changePage}>Volver</button>
                <button className={activo? 'register-button registerBut shown': 'register-button registerBut not-shown'}>Registrar</button>
                <button className={activo? "register-button next not-shown":"register-button next shown"} onClick={changePage}>Siguiente</button>
            </div>
        </div>
        
    </div>
);}
