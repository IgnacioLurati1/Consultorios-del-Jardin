import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faGreaterThan} from '@fortawesome/free-solid-svg-icons'
import '../styles/Register.css';
import { DataInput } from '../components/DataInput';
import { DataInputDataList } from '../components/DataInputDataList';

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
                <DataInput label="Nombre"/>
                <DataInput label="Apellido"/>
                </div>
                <DataInput label="Email"/>
                <DataInput label="Contraseña"/>
                <DataInput label="Confirmar contraseña"/>
                <DataInput label="Teléfono"/>
                <div className='document-dataInput'>
                    <div className='tipoDoc'>
                    <DataInputDataList label="Tipo documento" 
                    options={["DNI", "Pasaporte", "Cédula de Identidad", "Libreta de Enrolamiento", "Libreta Cívica", "Otro"]}/>
                    </div>
                    <div className='nroDoc'><DataInput label="Nro. documento"/></div>
                </div>
                <div className='speciality'>
                    <DataInputDataList label="Especialidad" 
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
