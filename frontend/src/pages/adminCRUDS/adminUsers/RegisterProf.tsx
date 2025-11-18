import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faGreaterThan} from '@fortawesome/free-solid-svg-icons'
import '../../register/Register.css'
import Logo from '../../../assets/Logo.png';
import { useState } from "react";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { DataInput } from '../../../components/inputs/standardTextInput/DataInput';
import { DataInputPassword } from '../../../components/inputs/passwordInput/DataInputPassword';
import { DataInputSelector } from '../../../components/inputs/selectorInput/DataInputSelector';
import { registerProfessional } from './usersService';
import { useNavigate } from 'react-router-dom';

export function RegisterProf() {
    const navigate = useNavigate();
    const [activo, setPage] = useState(false);
    const [showButton, setShowButton] = useState(true);
    
    const changePage = () => {
        setPage(!activo);
    }

    const [formData, setFormData] = useState({
        name: '',
        surname: '',
        email: '',
        password: '',
        confirmPassword: '',
        phoneNumber: '',
        docType: '',
        docNumber: '',
        speciality: ''
    });

    const handleChange = (field: string, value: string) => {
            setFormData(prev => ({
                ...prev,
                [field]: value
            }));
        };
    
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        toast.dismiss();

        if (formData.password !== formData.confirmPassword) {
            toast.error("Las contraseñas no coinciden", {
                className: "feedBack-box error"})
                return;
        }
        // Validaciones mínimas (También se tiene que hacer en el backend)
            if (!formData.email || !formData.name || !formData.surname || !formData.password || !formData.confirmPassword || 
                !formData.phoneNumber || !formData.docType || !formData.docNumber) {
                toast.error("Complete todos los campos requeridos", {
                    className: "feedBack-box error"})
                    return;
            }

        
        
        registerProfessional({
            name: formData.name,
            surname: formData.surname,
            email: formData.email,
            docType: formData.docType,
            docNumber: formData.docNumber,
            phoneNumber: formData.phoneNumber,
            password: formData.password,
            speciality: formData.speciality,
            type: "professional",
            active:true
        })
            .then(() => {
            toast.success("Usuario registrado con éxito", {
            className: "feedBack-box success",});
            setShowButton(false);
            setTimeout(() => {
                    navigate("/")
                    window.scrollTo(0, 0);}
                  , 3000);
            })
            .catch((err: Error) => {
                toast.error(err.message || "Error al registrar usuario", {
                className: "feedBack-box error",
            });
        });

};

               
    return (
    <div className="user-register-container">

        <div className='register-title'>
            <FontAwesomeIcon className="title-icon" icon={faGreaterThan} />
            <h1 className='title-text'>Registro de Profesional</h1>
        </div>
        <form className="register-form" onSubmit={handleSubmit}>
            <div className='register-body'>
                <div className='register-body-left'>
                    <div className={activo? "shown":"not-shown"}>
                        <div className='register-namesurname'>
                        <DataInput label="Nombre" type="text" value={formData.name} onChange={(e) => handleChange('name', e.target.value)}/>
                        <DataInput label="Apellido" type="text" value={formData.surname} onChange={(e) => handleChange('surname', e.target.value)}/>
                    </div>
                    </div>
                    <div className={activo? "not-shown":"shown"}>
                        <DataInput label="Email" type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)}/>
                        <DataInputPassword label="Contraseña" value={formData.password} onChange={(e) => handleChange('password', e.target.value)}/>
                        <DataInputPassword label="Confirmar contraseña" value={formData.confirmPassword} onChange={(e) => handleChange('confirmPassword', e.target.value)}/>
                    </div>
                    <div className={activo? "shown":"not-shown"}>
                        <DataInput label="Teléfono" type="text" value={formData.phoneNumber} onChange={(e) => handleChange('phoneNumber', e.target.value)}/>
                        <div className='document-dataInput'>
                            <div className='tipoDoc'>
                            <DataInputSelector label="Tipo documento" type="selector"
                            options={["DNI", "Pasaporte", "Cédula de Identidad", "Libreta de Enrolamiento", "Libreta Cívica", "Otro"]}
                            value={formData.docType} onChange={(e) => handleChange('docType', e.target.value)}/>
                            </div>
                            <div className='nroDoc'>
                                <DataInput label="Nro. documento" type="text"value={formData.docNumber} onChange={(e) => handleChange('docNumber', e.target.value)}/>    
                            </div>
                        </div>
                        <div className='speciality'>
                            <DataInput label="Especialidad" type="text" value={formData.speciality} onChange={(e) => handleChange('speciality', e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                <div className='register-body-right professional-buttons'>
                    <div className='logo-consultorios'><img src={Logo} alt="Logo"/></div>
                    <button type="button" className={activo? 'register-button next shown': 'register-button next not-shown'} onClick={changePage}>Volver</button>
                    {showButton
                    ? <button type="submit" className={activo ? "register-button registerBut shown" : "register-button registerBut not-shown"} >Registrar</button>
                    : <div className="register-spinner"></div>}
                    <button type="button" className={activo? "register-button next not-shown":"register-button next shown"} onClick={changePage}>Siguiente</button>
                </div>
                    <ToastContainer 
                        closeOnClick={false}
                        draggable={false}
                    />
            </div>
        </form>
    </div>
  );
}

                
                