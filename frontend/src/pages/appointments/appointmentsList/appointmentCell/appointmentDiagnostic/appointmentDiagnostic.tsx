import { FaXmark } from "react-icons/fa6";
import type { Appointment, Diagnostic, Person } from "../../../../types.ts";
import { findPerson } from "../../../../commonServices.ts";
import { useEffect, useState } from "react";
import {AppointmentDiagnosticInfo} from "./appointmentDiagnosticInfo.tsx"
import { toast } from "react-toastify/unstyled";
import "./appointmentDiagnostic.css"

interface AppointmentDiagnosticProps {
    type: string
    appointment: Appointment;
    diagnostics: Diagnostic[];
    setShowDiagnostic: (show: boolean) => void;
    onDiagnosticUpdate?: () => void;
}

export function AppointmentDiagnostic({ type, appointment, diagnostics, setShowDiagnostic, onDiagnosticUpdate }: AppointmentDiagnosticProps) {
    const [selectedDiagnostic, setSelectedDiagnostic] = useState<Diagnostic>();
    const [patient, setPatient] = useState<Person>();
    const [patients, setPatients] = useState<(Person | undefined)[]>([]);

    useEffect(() => {
        if (appointment.type === "simple" && diagnostics.length > 0) {
                setSelectedDiagnostic(diagnostics[0]);
                findPerson(diagnostics[0].patient)
                    .then(data => { 
                        if (data) {
                            setPatient(data);
                        }
                    })
                    .catch(error => toast.error("Error al obtener el paciente", error));
            }
    }, [appointment.type, diagnostics]);
    
    useEffect(() => {
        if (appointment.type !== "simple") {
            const loadPatients = async () => {
                const patientPromises = diagnostics.map(d => findPerson(d.patient));
                try {
                    const loadedPatients = await Promise.all(patientPromises);
                    setPatients(loadedPatients);
                } catch (error) {
                    toast.error("Error al obtener los pacientes");
                }
            };
            loadPatients();
     }
    }, [appointment.type, diagnostics]);

    if (appointment.type === "simple" && selectedDiagnostic && patient) {
        return (
            <AppointmentDiagnosticInfo 
                appointment={appointment} 
                diagnostic={selectedDiagnostic} 
                onClose={() => setShowDiagnostic(false)} 
                type={type} 
                patient={patient}
                onDiagnosticUpdate={onDiagnosticUpdate}
            />
        );
    }

    return (
        <div className="appointment-diagnostic-background" onClick={()=>setShowDiagnostic(false)}>
            <div className="appointment-diagnostic-container" onClick={e => e.stopPropagation()}>
                <div className="appointment-diagnostic-header">
                    <div className="appointment-diagnostic-header-content">
                        <h2>Seleccione el paciente</h2>
                        <div className="appointment-diagnostic-close-button" onClick={() => setShowDiagnostic(false)}>
                            <FaXmark />
                    </div>
                    </div>
                </div>
                <div className="appointment-diagnostic-content">
                    {patients.map((patient) => (
                        <div key={patient?.email} className="appointment-diagnostic-patient-item">
                            <button 
                                className="appointment-diagnostic-select-button" 
                                onClick={() => { 
                                    const found = diagnostics.find(d => d.patient === patient?.email);
                                    console.log("patient email:", patient?.email, "found diagnostic:", found);
                                    setSelectedDiagnostic(found);
                                    setPatient(patient); 
                                }}
                            >
                                {patient?.name} {patient?.surname}
                            </button>
                        </div>
                    ))}
                </div>
                <div className="appointment-diagnostic-footer">
                    <button className="appointment-diagnostic-button cancel-button" onClick={() => setShowDiagnostic(false)}>
                        Cancelar
                    </button>
                </div>
            </div>
            {selectedDiagnostic && patient && (
                <AppointmentDiagnosticInfo 
                    appointment={appointment} 
                    diagnostic={selectedDiagnostic} 
                    onClose={() => setShowDiagnostic(false)} 
                    type={type} 
                    patient={patient} 
                    onDiagnosticUpdate={onDiagnosticUpdate}
                />
            )}
        </div>
    );
}