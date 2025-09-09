import type { Schedule } from "../../types.ts"
import "./scheduleModal.css"
import { FaXmark } from "react-icons/fa6";

interface scheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    schedule: Schedule | undefined;
}

export function ScheduleModal({ isOpen, onClose, schedule }: scheduleModalProps) {
    if (!isOpen) return null;

    if(schedule){
    return (
        <div className="schedule-modal-overlay" onClick={onClose}>
            <div className="schedule-modal" onClick={(e) => e.stopPropagation()} /* Evita que el clic en el modal cierre el modal */ >
                <div className="schedule-modal-header">
                    <h2 className="schedule-modal-header-title">Detalles del Horario</h2> 
                    <button className="schedule-modal-header-close" onClick={onClose}> <FaXmark/> </button>
                </div>
                <div className="schedule-modal-content">
                    <p>Día: {schedule.day}</p>
                    <p>Hora de Inicio: {schedule.initialHour}</p>
                    <p>Hora de Fin: {schedule.finalHour}</p>
                    <p>Profesional: {schedule.Person}</p>
                    <p>Sala: {schedule.Room}</p>
                    <p>Tipo Permitido: {schedule.allowedType}</p>
                    <p>Duracion Permitida: {schedule.durations[0].duration}</p>
                </div>
            </div>
        </div>
    );} else {
        return null;
    }
}