import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faGreaterThan} from '@fortawesome/free-solid-svg-icons'
import '../styles/Register.css';
import { DataInput } from '../components/DataInput';

export function RegisterProf() {
  return (
    <div className="user-register-container">

        <div className='register-title'>
            <FontAwesomeIcon className="title-icon" icon={faGreaterThan} />
            <h1 className='title-text'>Registro de Profesional</h1>
        </div>
        <div className='register-body'>
            <div className='register-body-left'>
                <div className='register-namesurname'>
                <DataInput label="Nombre" type="text"/>
                <DataInput label="Apellido" type="text"/>
                </div>
                <DataInput label="Email" type="email"/>
                <DataInput label="Contraseña" type="password"/>
                <DataInput label="Confirmar contraseña" type="password"/>
                <DataInput label="Teléfono" type="text"/>
                <div className='document-dataInput'>
                    <div className='tipoDoc'>
                    <DataInput label="Tipo documento" type="selector"
                    options={["DNI", "Pasaporte", "Cédula de Identidad", "Libreta de Enrolamiento", "Libreta Cívica", "Otro"]}/>
                    </div>
                    <div className='nroDoc'><DataInput label="Nro. documento" type="text"/></div>
                </div>
                <div className='speciality'>
                    <DataInput label="Especialidad" type="selector"
                    options={["Especialidad1", "Especialidad2", "Especialidad3", "Especialidad4", "Especialidad5", "Otro"]}/>
                    </div>
                
            </div>
            <div className='register-body-right'>
                <div className='logo-consultorios'><img src="/assets/Logo.png" alt="Logo"/></div>
                <button className='register-button'>Registrar</button>
            </div>

        </div>
        
    </div>
  );
}

                
                