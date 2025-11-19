import { toast } from "react-toastify/unstyled";
import { useState, useEffect } from "react";
import type { Diagnostic, Person } from "../../../../types.ts";
import { findAllActiveClients } from "../../../../adminCRUDS/adminUsers/usersService.ts";
import { FaXmark } from "react-icons/fa6";
import { FaExclamationTriangle, FaAngleDown } from "react-icons/fa";
import "./appointmentAddPatientModal.css";


interface AppointmentAddPatientModalProps{
    isOpen: boolean;
    onClose: () => void;
    numAppo: string
    onAdd: (numAppo: string, patientEmail: string) => void;
    diagnostics: Diagnostic[]
}

export function AppointmentAddPatientModal({isOpen, onClose, numAppo,onAdd, diagnostics}:AppointmentAddPatientModalProps){
    
    const [patients, setPatients] = useState<Person[] | []>([]);
    const [filteredPatients, setFilteredPatients] = useState<Person[]>([]);
    const [patientSelector, setPatientSelector] = useState(false);
    const [patientInputValue, setPatientInputValue] = useState("");
    const [patient, setPatient] = useState<Person | undefined>(undefined);

    const [errors, setErrors] = useState<{patient?: string}>({});


    useEffect(() => {
            if (isOpen) { // Si se abre el modal para crear un nuevo turno
                setPatient(undefined);
                setPatientInputValue("");
                setPatientSelector(false);
                setErrors({});
            }
        }, [ isOpen]);
    
    useEffect(() => {
        findAllActiveClients()
        .then(data => {
            const notAddedPatients = data.filter(cli => !diagnostics.some(d => d.patient === cli.email));
            setPatients(notAddedPatients);
            setFilteredPatients(notAddedPatients);
        })
        .catch(err => {
            toast.error("Error cargando salas:", err);
        });
    }, [isOpen]);

    function handleKeyDown(event: React.KeyboardEvent) {
        if (event.key !== 'Enter') {
            return;
        } 
    }

    function validateInputs(){
        const newErrors: typeof errors = {};

        if(!patient){
            newErrors.patient = "El paciente es obligatorio"
        }

        setErrors(newErrors);

        if( Object.keys(newErrors).length ===0){
            return true
        }else 
            {return false}
    }

    function FilterPatients(text: string){
        const lowertext = text.toLocaleLowerCase();
        const filtered = patients.filter( pat => pat.email.toLocaleLowerCase().includes(lowertext) 
        || pat.name.toLocaleLowerCase().includes(lowertext) 
        ||pat.surname.toLocaleLowerCase().includes(lowertext))
        setFilteredPatients(filtered)
    }

    function handleAddPatient(){
        if(!validateInputs()) {
            console.log("Validación fallida", errors)
            toast.dismiss();
            return;
        }
        if(patient){
            onAdd(numAppo, patient.email)
            
        }
    }
    if (!isOpen) return null;
    return(
        <div className="appo-add-patient-modal-overlay" onClick={onClose}>
            <div className="prof-appo-modal" onClick={(e) => e.stopPropagation()}  onKeyDown={handleKeyDown}>
                <div className="appo-add-patient-modal-header">
                    <h2 className="appo-add-patient-modal-header-title">Añadir un paciente</h2> 
                    <button className="appo-add-patient-modal-header-close" onClick={onClose}> <FaXmark/> </button>
                </div>
                <div className="appo-add-patient-modal-content">
                    <div className="appo-add-patient-modal-input-container">
                        <label>Paciente</label>
                        <div className="appo-add-patient-modal-form-select" onClick={() => setPatientSelector(!patientSelector)}>
                            <input 
                                className={`appo-add-patient-modal-input ${false? "input-error" : "input-valid"}`}  
                                placeholder="Buscá por paciente" 
                                value={patientInputValue}
                                type="text"
                                onChange={(e) => {
                                    setPatientInputValue(e.target.value);
                                    FilterPatients(e.target.value); 
                                    if(!patientSelector) setPatientSelector(true);
                                }} 
                                onFocus={() => {
                                    if(!patientSelector) setPatientSelector(true);
                                }}
                                onClick={(event) => {event.stopPropagation()
                                                    setPatientSelector(true)
                                }} 
                            />
                            <FaAngleDown className={patientSelector ? "appo-add-patient-modal-icon rotated" : "appo-add-patient-modal-icon"} />
                            {patientSelector && (
                            <ul className={"appo-add-patient-modal-filter-list" + (patientSelector ? " active" : " disabled")}>
                                    {filteredPatients.length > 0 ? (
                                        filteredPatients.map((patient) => (
                                            <li 
                                                className="appo-add-patient-modal-filter-list-item" 
                                                key={patient.email} 
                                                onClick={() => { 
                                                    setPatient(patient);
                                                    setPatientInputValue(`${patient.surname}, ${patient.name} - ${patient.email}`);
                                                    setPatientSelector(false);
                                                }}
                                            >
                                                {patient.surname}, {patient.name} - {patient.email}
                                            </li>
                                        ))
                                    ) : (
                                        <li className="appo-add-patient-modal-filter-list-item appo-add-patient-modal-no-results">No se encontraron resultados</li>
                                    )}
                                </ul>
                            )}
                        </div>
                            <div className="appo-add-patient-modal-error-container">
                            {errors.patient && 
                                <div className="appo-add-patient-modal-error-text">
                                    <FaExclamationTriangle className="appointment-input-error-icon"/>{errors.patient}
                                </div>
                            }
                        </div>
                    </div>
                </div>
                <div className="appo-add-patient-modal-button-container">
                    <button className="appo-add-patient-modal-create-button" onClick={()=>{handleAddPatient()}}>Agendar paciente</button>
                </div>
            </div>
        </div>
    );
}