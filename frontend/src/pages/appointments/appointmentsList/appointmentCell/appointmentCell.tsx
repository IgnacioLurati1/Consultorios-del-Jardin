import type { Appointment } from "../../../types.ts";
import { FaUserDoctor, FaLocationDot } from "react-icons/fa6";
import "./appointmentCell.css";
import { findPerson } from "../../../commonServices.ts";
import { toast } from "react-toastify/unstyled";
import { useEffect, useState } from "react";

interface AppointmentCellProps {
    appointment: Appointment;
    userType: string;
}

export function AppointmentCell({ appointment, userType }: AppointmentCellProps) {

    const dateObj = new Date(appointment.date);
    const nombreMes = new Intl.DateTimeFormat('es-ES', { month: 'short', timeZone: 'UTC' }).format(dateObj).toUpperCase();
    const [professionalName, setProfessionalName] = useState("Cargando...");

    useEffect(() => {
        setProfessionalName("Cargando...");

        findPerson(appointment.professional)
            .then(data => {
                if (data) {
                    // 4. Actualiza el ESTADO, no una variable local
                    setProfessionalName(`${data.name} ${data.surname}`);
                } else {
                    setProfessionalName("No encontrado");
                }
            })
            .catch(err => {
                toast.error(`Error al cargar al profesional: ${err.message}`);
                setProfessionalName("Error"); 
            });
        }, [appointment.professional]);


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
                    <div><FaUserDoctor/> {professionalName}</div>
                    <div><FaLocationDot/>{appointment.room.office.description} {appointment.room.description}</div>
                </div>
            </div>
            <div className="appointment-cell-buttons">
                {userType === "professional" ? (
                    <>
                    <button className="appointment-cell-button diagnostic-button">Diagnóstico</button>
                    <button className="appointment-cell-button mark-button">No atendido</button>
                    </>): <></>}
                <button className="appointment-cell-button cancel-button">Cancelar</button>
            </div>
        </div>
    );
}