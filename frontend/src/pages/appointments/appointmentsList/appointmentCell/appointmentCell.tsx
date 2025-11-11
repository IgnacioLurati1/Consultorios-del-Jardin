import { type Diagnostic, type Appointment, type Person } from "../../../types.ts";
import { FaUserDoctor, FaLocationDot, FaXmark, FaClipboard, FaClock } from "react-icons/fa6";
import "./appointmentCell.css";
import { findPerson } from "../../../commonServices.ts";
import { toast } from "react-toastify/unstyled";
import { useEffect, useState } from "react";
import { acceptAppointment, cancelAppointmentService, GetAppointmentDiagnostics } from "../../appointmentsService.ts";
import { ConfirmCancel } from "./confirmCancel.tsx";
import { AppointmentDiagnostic } from "./appointmentDiagnostic/appointmentDiagnostic.tsx";
import { FaCheck } from "react-icons/fa";

interface AppointmentCellProps {
    appointment: Appointment;
    user: Person;
}

export function AppointmentCell({ appointment, user }: AppointmentCellProps) {

    const dateObj = new Date(appointment.date);
    const nombreMes = new Intl.DateTimeFormat('es-ES', { month: 'short', timeZone: 'UTC' }).format(dateObj).toUpperCase();
    const [personName, setPersonName] = useState("Cargando...");
    const [isCanceled, setIsCanceled] = useState(false);
    const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
    const [showCancel, setShowCancel] = useState(false);
    const [showDiagnostic, setShowDiagnostic] = useState(false);
    const [cancelDate, setCancelDate] = useState(appointment.cancelDate);

    useEffect(() => {
    GetAppointmentDiagnostics(appointment.numAppointment)
    .then(data => {
        setDiagnostics(data);
    })
    .catch(err => {
        toast.error(`Error al cargar los diagnósticos: ${err.message}`);
    });
    }, []);

    useEffect(() => {
        setPersonName("Cargando...");
        if(user.type === "professional" && appointment.type === "simple" && diagnostics.length > 0){
            let person = diagnostics[0].patient;
            findPerson(person)
            .then(data => {
                if (data) {
                    setPersonName(`${data.name} ${data.surname}`);
                } else {
                    setPersonName("No encontrado");
                }
            })
            .catch(err => {
                toast.error(`Error al cargar a la persona: ${err.message}`);
                setPersonName("Error");
            });
        }
        else if (user.type === "professional" && appointment.type === "taller"){
            setPersonName("Varios pacientes");
        }
        else {
            findPerson(appointment.professional)
            .then(data => {
                if (data) {
                    setPersonName(`${data.name} ${data.surname}`);
                } else {
                    setPersonName("No encontrado");
                }
            })
            .catch(err => {
                toast.error(`Error al cargar a la persona: ${err.message}`);
                setPersonName("Error");
            });
        }

    }, [diagnostics]);

    useEffect(() => {
        if (appointment.cancelDate != "pending" && appointment.cancelDate != "accepted" && !isCanceled) {
            setIsCanceled(true);
        }
        if(user.type === "client" && appointment.type === "taller" && diagnostics.length > 0){
            let patientDiagnostic = diagnostics.find(d => d.patient === user.email);
            if(patientDiagnostic?.state === "canceled" && !isCanceled){
                setIsCanceled(true);
            }
        }
    }, [appointment, diagnostics]);
        
    function cancelAppointment(numAppointment: number){
        cancelAppointmentService(numAppointment)
        .then((success:boolean) => {
            if (success) {
                setIsCanceled(true);
                toast.success("Cita cancelada");
        }else{
            toast.error("Error al cancelar la cita");
        }    
        });
    }

    function handleAcceptAppointment(numAppointment: number){
        acceptAppointment(numAppointment)
        .then((success:boolean) => {
            if (success) {
                setCancelDate("accepted");
                toast.success("Cita aceptada");
            } else {
                toast.error("Error al aceptar la cita");
            }
        })
        .catch(err => {
            toast.error(`Error al aceptar la cita: ${err.message}`);
        });
    }   

    function handleDiagnosticUpdate(){
        GetAppointmentDiagnostics(appointment.numAppointment)
        .then(data => {
            setDiagnostics(data);
        })
        .catch(err => {
            toast.error(`Error al cargar los diagnósticos: ${err.message}`);
        });
    }

    return (
        <div className="appointment-cell">
            <div className="appointment-cell-data">
                <div className="appointment-cell-datetime">
                    <div>{dateObj.getUTCFullYear()}</div>

                    <div className={`appointment-cell-month-day ${appointment.type === "simple" ? "simple-appointment" : "taller-appointment"}`}>
                        <div>{dateObj.getUTCDate()}</div>
                        <div>{nombreMes}</div>
                    </div>

                    <div>{appointment.initialHour.substring(0, 5)} - {appointment.finalHour.substring(0, 5)}</div>
                </div>

                <div className="appointment-cell-details">
                    <div><FaUserDoctor/> {personName}</div>
                    <div><FaLocationDot/>{appointment.room.office.description} {appointment.room.description}</div>
                </div>
            </div>
            <div className="appointment-cell-buttons">
                {user.type === "professional" && !isCanceled? (
                    <>
                    <button className="appointment-cell-button diagnostic-button" onClick={()=> setShowDiagnostic(true)}><FaClipboard/> Diagnóstico</button>
                    {cancelDate === "pending" ? (
                        <button className="appointment-cell-button pending-button" onClick={()=>handleAcceptAppointment(appointment.numAppointment)}>
                            <FaClock/><span className="default-text">Pendiente</span><span className="hover-text">Aceptar</span>
                        </button>
                    ) : cancelDate === "accepted" && diagnostics.every(d => d.state === "assisted") ? (
                        <button className="appointment-cell-button attended-button"><FaCheck/> Atendido</button>
                    ) : (
                        <button className="appointment-cell-button mark-button"><FaClock/> No atendido</button>
                    )}
                    </>): 
                <></>}
                {isCanceled ? (
                    <button className="appointment-cell-button canceled-button" disabled>Cancelado</button>
                ) : (
                    <button className="appointment-cell-button cancel-button" onClick={() => setShowCancel(true)}><FaXmark/>Cancelar</button>
                )}
            </div>
            <div className="appointment-cell-confirm-cancel">
                {showCancel && (
                    <ConfirmCancel
                        setShowCancel={setShowCancel}
                        numAppointment={appointment.numAppointment}
                        cancelAppointment={cancelAppointment}
                    />
                )}
                {showDiagnostic && (
                    <AppointmentDiagnostic
                        type={user.type}
                        appointment={appointment}
                        diagnostics={diagnostics}
                        setShowDiagnostic={setShowDiagnostic}
                        onDiagnosticUpdate={handleDiagnosticUpdate}
                    />
                )}
            </div>
        </div>
    );
}