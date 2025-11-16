import { FaXmark } from "react-icons/fa6";
import type { DiagnosticPopulatedAppointment, Person } from "../../../../types";

interface medicalHistoryDiagnosticProps{
    setMedicalHistoryDiagnostic: (d: DiagnosticPopulatedAppointment | undefined) => void;
    diagnostic: DiagnosticPopulatedAppointment
    patient: Person
}

export function MedicalHistoryDiagnostic({setMedicalHistoryDiagnostic, diagnostic, patient}: medicalHistoryDiagnosticProps){
    return (<div className="appointment-diagnostic-background" onClick={()=>setMedicalHistoryDiagnostic(undefined)}>
                                <div className="appointment-diagnostic-container">
                                <div className = "appointment-diagnostic-header">
                                    <div className="appointment-diagnostic-header-content">
                                        <h2>Diagnóstico de {patient.name} {patient.surname} {diagnostic.appointment.date.slice(0, 10).split("-").reverse().join("/")}</h2>
                                        <div className="appointment-diagnostic-close-button" onClick={()=>setMedicalHistoryDiagnostic(undefined)}><FaXmark /></div>
                                    </div>
                                </div>
                                <div className="appointment-diagnostic-content">
                                     <textarea
                                        value={diagnostic.observations}
                                        className="appointment-diagnostic-textarea"
                                        placeholder="Sin diagnóstico disponible"
                                        disabled
                                        ></textarea>
                                </div>
                                <div className="appointment-diagnostic-footer">
                                    <button className="appointment-diagnostic-button cancel-button" onClick={()=>setMedicalHistoryDiagnostic(undefined)}>Volver atrás</button>
                                </div>
                                </div>
                            </div>)
}