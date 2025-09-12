import type { Schedule } from "../../types.ts"
import "./scheduleModal.css"
import { FaXmark } from "react-icons/fa6";

interface scheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    schedule: Schedule | undefined;
    daysSpanish: string[];
}

export function ScheduleModal({ isOpen, onClose, schedule, daysSpanish }: scheduleModalProps) {
    if (!isOpen) return null;

    if(schedule){ //ver info de un horario - FALTA PODER ELIMINARLO
    return (
        <div className="schedule-modal-overlay" onClick={onClose}>
            <div className="schedule-modal" onClick={(e) => e.stopPropagation()} /* Evita que el clic en el modal cierre el modal */ >
                <div className="schedule-modal-header">
                    <h2 className="schedule-modal-header-title">Detalles del Horario</h2> 
                    <button className="schedule-modal-header-close" onClick={onClose}> <FaXmark/> </button>
                </div>
                <div className="schedule-modal-content">
                    <div>Día: {schedule.day.charAt(0).toUpperCase() + schedule.day.slice(1)}</div>
                    <div>Hora de Inicio: {schedule.initialHour} hs</div>
                    <div>Hora de Fin: {schedule.finalHour} hs</div>
                    <div>Profesional: {schedule.person.surname}, {schedule.person.name}</div>
                    <div>Sala: {schedule.room.description}</div>
                    <div>Tipo de turno: {schedule.allowedType.charAt(0).toUpperCase() + schedule.allowedType.slice(1)}</div>
                    <div>Duracion Permitida: {schedule.duration} min</div>
                    <div className="button-container">
                        <button className="delete-button">Eliminar</button>
                    </div>
                </div>
            </div>
        </div>
    );} else { //crear horario
    return (
        <div className="schedule-modal-overlay" onClick={onClose}>
            <div className="schedule-modal" onClick={(e) => e.stopPropagation()} /* Evita que el clic en el modal cierre el modal */ >
                <div className="schedule-modal-header">
                    <h2 className="schedule-modal-header-title">Crear un Horario</h2> 
                    <button className="schedule-modal-header-close" onClick={onClose}> <FaXmark/> </button>
                </div>
                <div className="schedule-modal-content">
                    <div className="modal-input-container">
                        <label>Día</label>
                        <select className="input-modal input-valid">
                            {daysSpanish.map((day)=>
                                <option value={day}>{day.charAt(0).toUpperCase() + day.slice(1)}</option>
                            )}
                        </select>
                    </div>
                    
                    <div className="time-input-container">
                        <div className="modal-input-container">
                            <label>Hora inicio</label>
                            <input type="time" className={`input-modal ${false? "input-error" : "input-valid"}`}/> {/*ESTILO PARA LUEGO IMPLEMENTAR EL ERROR EN EL INPUT*/ }
                        </div>
                        <div className="modal-input-container endHour">
                            <label>Hora fin</label>
                            <input type="time" className={`input-modal ${false? "input-error" : "input-valid"}`}/> 
                        </div>
                    </div>
                    <div className="modal-input-container">
                        <label>Profesional</label>
                        <input type="text" className={`input-modal ${false? "input-error" : "input-valid"}`}/> {/*ACA IRIA UN DATALIST O SELECT QUE PERMITA ESCRITURA*/}
                    </div>
                    <div className="modal-input-container">
                        <label>Sala</label>
                        <input type="text" className={`input-modal ${false? "input-error" : "input-valid"}`}/> {/*ACA IRIA UN DATALIST O SELECT QUE PERMITA ESCRITURA*/}
                    </div>
                    <div className="modal-input-container">
                        <label>Tipo de turno.</label>
                        <select className="input-modal input-valid">
                            <option value="simple">Simple</option>
                            <option value="taller">Taller</option>
                        </select>
                    </div>
                    <div className="modal-input-container">
                        <label>Duración</label>
                        <input type="text" className={`input-modal ${false? "input-error" : "input-valid"}`}/> {/*ACA IRIA UN DATALIST O SELECT QUE PERMITA ESCRITURA*/}
                    </div>
                    

                    <div className="button-container">
                        <button className="create-button">Crear horario</button>
                    </div>
                </div>
            </div>
        </div>
        
    );}
}