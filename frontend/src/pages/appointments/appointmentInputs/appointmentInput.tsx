import { useState, useEffect } from 'react';
import { findAllActiveOffices } from "../../adminCRUDS/adminOffices/OfficeService.ts";
import { ToastContainer, toast } from "react-toastify";
import type{Office, Person} from "../../types.ts"
import './appointmentInput.css';
import { findAllActiveProfessionals, findProfessionalsOfficeSpecialty } from "../../adminCRUDS/adminUsers/usersService.ts";
import { FaExclamationTriangle } from "react-icons/fa";
import { ProfessionalCard } from './professionalCard.tsx';

export function AppointmentInput() {
const [officesList, setOfficesList] = useState<Office[] | []>([]);
const [office, setOffice] = useState<Office>();
const [professionalsList, setProfessionalsList] = useState<Person[] | []>([]);
const [specialty, setSpecialty] = useState<string>();
const [showAppointments, setShowAppointments] = useState(false);
const [filteredProfessionals, setFilteredProfessionals] = useState<Person[] | []>([]);
const [errors, setErrors] = useState<{office?:string ,professional?:string, specialty?: string}>({});

function validateInputs(){
        const newErrors: typeof errors = {};

        if(!office){
            newErrors.office = "El consultorio es obligatorio"
        }
        /*if(!specialty && !professional && !office){
            newErrors.specialty = "Ingrese un profesional o una especialidad"
        }*/

        setErrors(newErrors);

        if( Object.keys(newErrors).length ===0){
            return true
        }else 
            {return false}
    }

useEffect(() => {
    findAllActiveOffices()
    .then(data => {
        setOfficesList(data);
    })
    .catch(err => {
        toast.error("Error cargando salas:", err);
    });
}, []);

useEffect(() => {
    findAllActiveProfessionals()
    .then(data => {
        setProfessionalsList(data);
    })
    .catch(err => {
        toast.error("Error cargando profesionales:", err);
    });
}, []);

function findFilteredProfessionals(){
    if ((office && specialty) || (office)){
        console.log("Buscando profesionales con consultorio y especialidad:", specialty);
        console.log("Consultorio ID:", office.idOffice);
        console.log(typeof(String(office.idOffice)));
        findProfessionalsOfficeSpecialty(String(office.idOffice),specialty)
        .then(data => {
            setFilteredProfessionals(data);
            
        })
        .catch(err => {
            toast.error("Error cargando profesionales con ese consultorio y esa oficina:", err);
        });
    }
}

const handleSearch = () => {
    if(!validateInputs()) {
            toast.dismiss();
        return;}
    setShowAppointments(true);
    findFilteredProfessionals();
};

return (
    <>
        <div className= {showAppointments ? 'appointments-input-container reduced' : 'appointments-input-container'}>
            <div className={showAppointments ? 'appointment-content reduced' : 'appointment-content'}>
                <div className="appointment-title"> Encontrá tu turno</div>
                <div className="appointment-card">
                    <div className="form-grid">
                        <div className="form-field">
                            <label className="form-label">Consultorio</label>
                                <select 
                                    className="form-select"
                                    value={office?.idOffice || ""} 
                                    onFocus={() => {
                                        setOffice(undefined);
                                    }}
        
                                    onChange={(e) => {
                                        const selectedOffice = officesList.find(r => r.idOffice == e.target.value);
                                        
                                        if (selectedOffice){
                                            setOffice(selectedOffice);
                                        }
                                    }}
                                >
                                    <option value="" disabled>Buscá por consultorio</option>
                                    {officesList.map((office)=>
                                        <option key={office.idOffice} value={office.idOffice}>{office.description+ ", " + office.city.nameCity}</option>
                                    )}
                                </select>
                                <div className="error-container">
                                {errors.office && 
                                    <div className="error-text">
                                        <FaExclamationTriangle className="error-icon"/>{errors.office}
                                    </div>}
                                </div>
                        </div>

                        {/*<div className="form-field">
                            <label className="form-label"> Profesional</label>
                            <select 
                                    className="form-select"
                                    value={professional?.email || ""} 
                                    onFocus={() => {
                                        setProfessional(undefined);
                                    }}
        
                                    onChange={(e) => {
                                        const selectedProfessional = professionalsList.find(r => r.email == e.target.value);
                                        
                                        if (selectedProfessional){
                                            setProfessional(selectedProfessional);
                                        }
                                    }}
                                >
                                    <option value="" disabled>Buscá por profesional</option>
                                    {professionalsList.map((prof)=>
                                        <option key={prof.email} value={prof.email}>{prof.name+ ", " + prof.surname}</option>
                                    )}
                                </select>
                                <div className="error-container">
                                {errors.professional && 
                                    <div className="error-text">
                                        <FaExclamationTriangle className="error-icon"/>{errors.professional}
                                    </div>}
                                </div>
                        </div>*/}
                        <div className="form-field">
                            <label className="form-label">Especialidad</label>
                            <select 
                                    className="form-select"
                                    value={specialty || ""} 
                                    onFocus={() => {
                                        setSpecialty(undefined);
                                    }}
        
                                    onChange={(e) => {
                                        const selectedSpecialty = e.target.value
                                        
                                        if (selectedSpecialty){
                                            setSpecialty(selectedSpecialty);
                                        }
                                    }}
                                >
                                    <option value="" disabled>Buscá por especialidad</option>
                                    {professionalsList.map((prof)=>
                                        <option key={prof.email} value={prof.speciality}>{prof.speciality}</option>
                                    )}
                                </select>
                                <div className="error-container">
                                {errors.specialty && 
                                    <div className="error-text">
                                        <FaExclamationTriangle className="error-icon"/>{errors.specialty}
                                    </div>}
                                </div>
                        </div>
                    </div>

                    <div className="form-actions">
                        <div className="form-hint">
                            {showAppointments ? `${filteredProfessionals.length} resultados encontrados` : "Ingrese consultorio y profesional y/o especialidad"}
                        </div>

                        <button onClick={handleSearch} className="search-button">
                            Buscar turnos
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <div className={showAppointments ? 'results-container' : 'results-container hidden'}>
            <div className="professionals-results-content">
                {
                    filteredProfessionals.length === 0 ? (
                    <div>
                        <h2 className="no-results-title">No se encontraron resultados</h2>
                    </div>
                    ) : (
                    showAppointments && filteredProfessionals.map((professional) => (
                        <ProfessionalCard key={professional.email} professional={professional} office={office} display={showAppointments}/>
                    ))
                    )
                }
            </div>
        </div>
    </>
    );
};