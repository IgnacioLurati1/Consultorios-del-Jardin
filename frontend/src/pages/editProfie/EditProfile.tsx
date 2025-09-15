import Logo from '../../assets/LogoRecortado.png';
import { faGreaterThan } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { toast, ToastContainer } from "react-toastify";
import { DataInputSelector } from "../../components/inputs/selectorInput/DataInputSelector";
import { DataInput } from "../../components/inputs/standardTextInput/DataInput";
import { useState, useEffect } from "react";
import api from "../../axios";
import type { TokenPayload } from '../types';
import { jwtDecode } from 'jwt-decode';
import "../register/Register.css"


//Exactamente la misma página del registro pero con otra funcionalidad

export function EditProfile(){


    const [token, setToken] = useState<string|null>(null)
    const [formData, setFormData] = useState({
        name: '',
        surname: '',
        email: '',
        phoneNumber: '',
        docType: '',
        docNumber: ''
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
        // Validaciones mínimas (También se tiene que hacer en el backend)
        if (!formData.name || !formData.surname ||
            !formData.phoneNumber|| !formData.docType || !formData.docNumber) {
            toast.error("No puedes dejar campos vacios")
                return;
        }

        api.put(`/people/${formData.email}`, {
            name: formData.name,
            surname: formData.surname,
            docType: formData.docType,
            docNumber: formData.docNumber,
            phoneNumber : formData.phoneNumber,
        })
        .then(response => {
            if(response.data.token){
                localStorage.setItem("token", response.data.token);
                toast.success("Usuario registrado con éxito");
            }

        })
        .catch(error => {
            console.error("Error:", error);
            toast.error("Error al modificar usuario")
        });
    };



    useEffect(()=>{

        const storedToken=localStorage.getItem("token")
        if(!storedToken) return;

        const decoded = jwtDecode<TokenPayload>(storedToken);
        setToken(storedToken)

        api.get(`/people/${decoded.email}`)
        .then(res => { console.log(res.data.data)
            const personaEncontrada = {
                name: res.data.data.name,
                surname: res.data.data.surname,
                email: res.data.data.email,
                docType: res.data.data.docType,
                docNumber: res.data.data.docNumber,
                phoneNumber: res.data.data.phoneNumber,
            }

            setFormData(personaEncontrada);
        }       
        )

    },[]);

    if(!token){
        return(
            <div>Loading...</div>
        );
    }
    else{

        return (
            <div className="user-register-container">
        
                <div className='register-title'>
                    <FontAwesomeIcon className="title-icon" icon={faGreaterThan} />
                    <h1 className='title-text'>Datos del Usuario</h1>
                </div>
                <form className="register-form" onSubmit={handleSubmit}>
                    <div className='register-body'>
                            <div className='register-body-left'>
        
                                <DataInput label="Nombre" type="text" value={formData.name} onChange={(e) => handleChange('name', e.target.value)}/>
                                <DataInput label="Apellido" type="text" value={formData.surname} onChange={(e) => handleChange('surname', e.target.value)}/>
        
                                <DataInput label="Email" type="email" value={formData.email} disabled={true}/>
                                
                                    <DataInput label="Teléfono" type="text" value={formData.phoneNumber} onChange={(e) => handleChange('phoneNumber', e.target.value)}/>
                                    <div className='document-dataInput'>
                                        <div className='tipoDoc'>
                                        <DataInputSelector label="Tipo documento" type="selector" options={["DNI", "Pasaporte", "Cédula de Identidad", "Libreta de Enrolamiento", "Libreta Cívica", "Otro"]} 
                                        value={formData.docType} onChange={(e) => handleChange('docType', e.target.value)}/>
                                        </div>
                                        <div className='nroDoc'>
                                            <DataInput label="Nro. documento" type="text" value={formData.docNumber} onChange={(e) => handleChange('docNumber', e.target.value)}/> 
                                        </div>
                                    </div>
                            </div>
        
                            <div className='register-body-right'>
                                <div className='logo-consultorios'><img src={Logo} alt="Logo"/></div>
        
                                <div className="toast-container">
                                <ToastContainer
                                position='top-right'
                                closeOnClick={false}
                                draggable={false}/>
                                </div>
        
                                <button type="submit" className='register-button registerBut shown'>Modificar</button>
                            </div>
                    </div>
                </form>
            </div>
    )
    }
}