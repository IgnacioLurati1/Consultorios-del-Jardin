import { FaXmark } from "react-icons/fa6";
import type { Appointment, Diagnostic, Person } from "../../../../types";
import "./appointmentDiagnostic.css"
import { updateDiagnostic } from "../../../appointmentsService";
import { useState } from "react";
import { toast } from "react-toastify";
import { MedicalHistoryList } from "./medicalHistoryList";

interface AppointmentDiagnosticInfoProps {
    appointment: Appointment;
    diagnostic: Diagnostic;
    onClose?: () => void;
    type: string;
    patient: Person;
    onDiagnosticUpdate?: () => void;
}

export function AppointmentDiagnosticInfo({ appointment, diagnostic, onClose, type, patient, onDiagnosticUpdate}: AppointmentDiagnosticInfoProps) {

    const [observations, setObservations] = useState(diagnostic.observations);
    const [localState, setLocalState] = useState(diagnostic.state);
    const [showMedicalHistories, setShowMedicalHistories] = useState(false);
    
    function setAttendance(attendance: string){
        updateDiagnostic(appointment.numAppointment, patient.email, observations, attendance)
        .then(success => {
            if (success) {
                setLocalState(attendance);
                toast.success("Diagnóstico actualizado");
                if (onDiagnosticUpdate) {
                    onDiagnosticUpdate();
                }
            } else {
                toast.error("Error al actualizar el diagnóstico");
            }
        });
    }

    function saveDiagnostic(){
        if(observations && observations.trim() !== "" && localState !== "assisted"){
            updateDiagnostic(appointment.numAppointment, patient.email, observations, "assisted")
            .then(success => {
                if (success) {
                    toast.success("Diagnóstico guardado");
                    if (onDiagnosticUpdate) {
                        onDiagnosticUpdate();
                    }
                    if (onClose) onClose();
                } else {
                    toast.error("Error al guardar el diagnóstico");
                }
            });
        }
    }

    if (type == "professional") {
        return (<div className="appointment-diagnostic-background" onClick={onClose}>
                            <div className="appointment-diagnostic-container" onClick={e => e.stopPropagation()}>
                                <div className = "appointment-diagnostic-header">
                                    <div className="appointment-diagnostic-header-content">
                                        <h2>Diagnóstico de {patient.name} {patient.surname} {appointment.date.slice(0, 10).split("-").reverse().join("/")}</h2>
                                        <div className="appointment-diagnostic-close-button" onClick={onClose}><FaXmark /></div>
                                    </div>
                                </div>
                                <div className="appointment-diagnostic-content">
                                     <textarea
                                        value={observations}
                                        className="appointment-diagnostic-textarea"
                                        onChange={(e) => setObservations(e.target.value)}
                                        placeholder="Escriba el diagnóstico aquí..."
                                        ></textarea>
                                </div>
                                <div className="appointment-diagnostic-footer">
                                    <button className="appointment-diagnostic-button cancel-button" onClick={onClose}>Cancelar</button>
                                    <button className="appointment-diagnostic-button medical-history-button" onClick={()=>setShowMedicalHistories(true)}>Ver historia clínica</button>
                                    {localState === "assisted" ? (
                                        <button className="appointment-diagnostic-button assisted-marked-button" disabled>Asistido</button>
                                    ) : (
                                        <button className="appointment-diagnostic-button assisted-button" onClick={()=>setAttendance("assisted")}>Marcar como asistido</button>
                                    )}
                                    <button className="appointment-diagnostic-button save-button" onClick={saveDiagnostic}>Guardar</button>
                                </div>

                                {showMedicalHistories && (<MedicalHistoryList patient = {patient} setShowMedicalHistories = {setShowMedicalHistories}/>)}
                            </div>
                        </div>)}
    else {
        return (<div className="appointment-diagnostic-background" onClick={onClose}>
                            <div className="appointment-diagnostic-container">
                                <div className = "appointment-diagnostic-header">
                                    <div className="appointment-diagnostic-header-content">
                                        <h2>Diagnóstico de {patient.name} {patient.surname} {appointment.date.slice(0, 10).split("-").reverse().join("/")}</h2>
                                        <div className="appointment-diagnostic-close-button" onClick={onClose}><FaXmark /></div>
                                    </div>
                                </div>
                                <div className="appointment-diagnostic-content">
                                     <textarea
                                        value={observations}
                                        className="appointment-diagnostic-textarea"
                                        placeholder="Sin diagnóstico disponible"
                                        disabled
                                        ></textarea>
                                </div>
                                <div className="appointment-diagnostic-footer">
                                    <button className="appointment-diagnostic-button cancel-button" onClick={onClose}>Cerrar</button>
                                </div>
                            </div>
                        </div>)}
    }