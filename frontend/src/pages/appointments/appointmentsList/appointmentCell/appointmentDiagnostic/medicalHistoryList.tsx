import { FaXmark } from "react-icons/fa6";
import type { Diagnostic, DiagnosticPopulatedAppointment, Person } from "../../../../types";
import { getPatienMedicalHistory } from "../../../appointmentsService";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { MedicalHistoryDiagnostic } from "./medicalHistoryDiagnostic";
interface medicalHistoryListProps{
    patient: Person;
    setShowMedicalHistories: (state: boolean)=>void;
}

export function MedicalHistoryList({patient, setShowMedicalHistories}: medicalHistoryListProps){

    const [HistoriesList,setHistoriesList] = useState<DiagnosticPopulatedAppointment[]>([]);
    const [medicalHistoryDiagnostic,setMedicalHistoryDiagnostic]= useState<DiagnosticPopulatedAppointment | undefined> (undefined)
    
    useEffect(()=>{
        getPatienMedicalHistory(patient.email)
        .then(data => {
                const sortedData = [...data].sort((a, b) => {
                    const dateA = new Date(a.appointment.date);
                    const dateB = new Date(b.appointment.date);
                    
                    return dateB.getTime() - dateA.getTime();
                });
                
                setHistoriesList(sortedData);
        })
        .catch(err => toast.error("Error al obtener historia clinica", err));
    },[]);
    
    return (
        <div className="appointment-diagnostic-background" onClick={()=>setShowMedicalHistories(false)}>
            <div className="appointment-diagnostic-container" onClick={e => e.stopPropagation()}>
                <div className="appointment-diagnostic-header">
                    <div className="appointment-diagnostic-header-content">
                        <h2>Historia clínica de {patient.surname} {patient.name}</h2>
                        <div className="appointment-diagnostic-close-button" onClick={() => setShowMedicalHistories(false)}>
                            <FaXmark />
                    </div>
                    </div>
                </div>
                <div className="appointment-diagnostic-content">
                    {HistoriesList.map((diagnostic) => (
                        <div key={diagnostic.appointment.date} className="appointment-diagnostic-patient-item">
                            <button 
                                onClick={()=>setMedicalHistoryDiagnostic(diagnostic)}
                                className="appointment-diagnostic-select-button" 
                            >
                                {diagnostic.appointment.date.slice(0, 10).split("-").reverse().join("/")}
                            </button>
                        </div>
                    ))}
                </div>
                <div className="appointment-diagnostic-footer">
                    <button className="appointment-diagnostic-button cancel-button" onClick={() => setShowMedicalHistories(false)}>
                        Cancelar
                    </button>
                </div>
                {medicalHistoryDiagnostic && (<MedicalHistoryDiagnostic patient={patient} diagnostic={medicalHistoryDiagnostic} setMedicalHistoryDiagnostic={setMedicalHistoryDiagnostic}/>)}
            </div>

        </div>
    );
}
