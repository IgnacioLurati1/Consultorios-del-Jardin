import type { Room, Office, City } from "../../types.ts"
import type { scheduleModalProps } from "../scheduleTypes.ts"
import "./scheduleModal.css"
import { FaXmark } from "react-icons/fa6";
import { FaExclamationTriangle } from "react-icons/fa";
import { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";

const durations: number[] = [15, 30, 60];

function validateOfficeTimes(initialHour:string, finalHour:string): boolean {
  if (initialHour && finalHour) {
    const initialHourInt = parseInt(initialHour.replace(":", ""), 10);
    const finalHourInt = parseInt(finalHour.replace(":", ""), 10);

    if (initialHourInt < finalHourInt) {
      return true;  // horario correcto
    }
    return false;   // horario inválido
  }
  return false; // faltan datos
}

export function ScheduleModal({isOpen, onClose, schedule, cellKey, daysSpanish, professional, rooms, offices, cities, onCreate, onDelete, isProfessional}: scheduleModalProps) {

    const [newScheduleData, setNewScheduleData] = useState({ day: "", initialHour: "", finalHour: "", person: professional.email, room:"", allowedType: "", duration: 0   });
    const [room, setRoom] = useState<Room>();
    const [filteredRooms, setFilteredRooms] = useState<Room[]>(rooms);
    const [office, setOffice] = useState<Office>();
    const [filteredOffices, setFilteredOffices] = useState<Office[]>(offices);
    const [city, setCity] = useState<City>();
    const [errors, setErrors] = useState<{initialHour?:string ,finalHour?:string, city?: string, office?: string, room?: string, duration?: string}>({});

    useEffect(() => {
        if (cellKey && isOpen) { // Si se abre el modal para crear un nuevo horario
            const [day, hour] = cellKey.split("-");
            setNewScheduleData({ day: day, initialHour: hour, finalHour: "", person: professional.email, room: "", allowedType: "simple", duration: 60 });
            setOffice(undefined);
            setRoom(undefined);
            setCity(undefined);
            setErrors({});
        }
    }, [cellKey, isOpen]);

    
    const createButtonRef = useRef<HTMLButtonElement| null>(null);

    function handleKeyDown(event: React.KeyboardEvent) {
        if (event.key !== 'Enter') {
            return;
        } 
        if (!schedule) {
            createButtonRef.current?.click();
        }
    }

    function validateInputs(){
        const newErrors: typeof errors = {};

        if(!newScheduleData.initialHour.trim()){
            newErrors.initialHour = "Ingrese hora de inicio"
        }
        if(!newScheduleData.finalHour.trim()){
            newErrors.finalHour = "Ingrese hora de fin"
        }
        if(!(newScheduleData.initialHour > "07:59")){
            newErrors.initialHour = "Hora de inicio inválida"
        }
        if(!(newScheduleData.finalHour < "21:01")){
            newErrors.finalHour = "Hora de fin inválida"
        }
        if(newScheduleData.finalHour.trim() && newScheduleData.initialHour.trim() && !validateOfficeTimes(newScheduleData.initialHour, newScheduleData.finalHour)){
            newErrors.initialHour = "Los horas son inválidas"
            newErrors.finalHour = "Los horas son inválidas"
        }
        if(!city){
            newErrors.city = "La ciudad es obligatoria"
        }
        if(!office){
            newErrors.office = "El consultorio es obligatorio"
        }
        if(!room){
            newErrors.room = "La sala es obligatoria"
        }
        if(!newScheduleData.duration){
            newErrors.duration = "La duración es obligatoria"
        }

        setErrors(newErrors);

        if( Object.keys(newErrors).length ===0){
            return true
        }else 
            {return false}
    }

    function handleSubmit(){

        if(!validateInputs()) {
            console.log("Validación fallida", errors)
            toast.dismiss();
        return;}

        if(!schedule && onCreate){
            onCreate({ day: newScheduleData.day, initialHour: newScheduleData.initialHour, finalHour: newScheduleData.finalHour, room: newScheduleData.room, personEmail: professional.email, allowedType: newScheduleData.allowedType, duration: newScheduleData.duration });
            
        }
    }

    function handleDelete(email:string, day:string, initialHour:string){
        if(schedule && onDelete){
            onDelete(email, day, initialHour);
        }
    }


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
                        <div>Sala: {schedule.room.description}</div>
                        <div className="button-container">
                            <button className={`delete-button ${isProfessional ? "isProf" : ""}`} onClick={()=> handleDelete(schedule.person.email, schedule.day, schedule.initialHour)}>Eliminar</button> 
                        </div>
                    </div>
                </div>
            </div>
        );
    } else if(!schedule && !isProfessional){ //crear horario
    return (
        <div className="schedule-modal-overlay" onClick={onClose}>
            <div className="schedule-modal" onClick={(e) => e.stopPropagation()}  onKeyDown={handleKeyDown}>
                <div className="schedule-modal-header">
                    <h2 className="schedule-modal-header-title">Crear un Horario</h2> 
                    <button className="schedule-modal-header-close" onClick={onClose}> <FaXmark/> </button>
                </div>
                <div className="schedule-modal-content">
                    <div className="modal-input-container">
                        <label>Día</label>
                        <select 
                            className="input-modal input-valid"
                            value={newScheduleData.day} 
                            onChange={(e) => setNewScheduleData({...newScheduleData, day: e.target.value})}
                        >
                            {daysSpanish.map((day)=>
                                <option key={day} value={day}>{day.charAt(0).toUpperCase() + day.slice(1)}</option>
                            )}
                        </select>
                        <div className="error-container"></div>
                    </div>
                    <div className="time-input-container">
                        <div className="modal-input-container">
                            <label>Hora inicio</label>
                            <input 
                                type="time" 
                                className={`input-modal ${false? "input-error" : "input-valid"}`} 
                                value={newScheduleData.initialHour}
                                step="3600"
                                onChange={(e) => 
                                    setNewScheduleData({...newScheduleData, initialHour: e.target.value
                                })}
                            />
                            <div className="error-container">
                                {errors.initialHour &&
                                    <div className="error-text">
                                        <FaExclamationTriangle className="error-icon"/>{errors.initialHour}
                                    </div>
                                }
                            </div>
                        </div>
                        <div className="modal-input-container">
                            <label>Hora fin</label>
                            <input 
                                type="time" 
                                className={`input-modal ${false? "input-error" : "input-valid"}`}
                                step="3600"
                                onChange={(e) => setNewScheduleData({...newScheduleData, finalHour: e.target.value})}
                            /> 
                            <div className="error-container">
                                {errors.finalHour &&
                                    <div className="error-text">
                                        <FaExclamationTriangle className="error-icon"/>{errors.finalHour}
                                    </div>
                                }
                            </div>
                        </div>
                    </div>
                    
                    <div className="modal-input-container">
                        <label>Profesional</label>
                        <input 
                            type="text" 
                            className="input-modal input-valid" 
                            value={professional.surname + ", " + professional.name} disabled 
                        /> 
                        <div className="error-container"></div>
                    </div>
                    <div className="modal-input-container">
                        <label>Ciudad</label>
                        <select 
                            className="input-modal input-valid"
                            value={city?.idCity||""} 
                            onFocus={() => {
                                setCity(undefined);
                                setOffice(undefined);
                                setFilteredOffices(offices);
                            }}

                            onChange={e => {
                                const selectedCity = cities.find(p => p.idCity == e.target.value);
                                if (selectedCity) {
                                    setCity(selectedCity);
                                    setFilteredOffices(offices.filter(office => office.city.idCity === selectedCity.idCity));
                            }}}
                        >
                            <option value="" disabled>Seleccione una ciudad</option>
                            {cities.map((city)=>
                                <option key={city.idCity} value={city.idCity}>{city.nameCity}</option>
                            )}
                        </select>
                        <div className="error-container">
                        {errors.city && 
                            <div className="error-text">
                                <FaExclamationTriangle className="error-icon"/>{errors.city}
                            </div>}
                        </div>
                    </div>
                    <div className="modal-input-container">
                        <label>Consultorio</label>
                        <select 
                            className="input-modal input-valid"
                            value={office?.idOffice || ""} 
                            onFocus={() => {
                                setOffice(undefined);
                                setRoom(undefined);
                                setFilteredRooms(rooms);
                            }}

                            onChange={(e) => {
                                const selectedOffice = offices.find(r => r.idOffice == e.target.value);
                                
                                if (selectedOffice){
                                    setOffice(selectedOffice);
                                    setFilteredRooms(rooms.filter(room => room.office.idOffice === selectedOffice.idOffice));
                                }
                            }}
                        >
                            <option value="" disabled>Seleccione un consultorio</option>
                            {city && filteredOffices.map((office)=>
                                <option key={office.idOffice} value={office.idOffice}>{office.description}</option>
                            )}
                        </select>
                        <div className="error-container">
                        {errors.office && 
                            <div className="error-text">
                                <FaExclamationTriangle className="error-icon"/>{errors.office}
                            </div>}
                        </div>
                    </div>
                    <div className="modal-input-container">
                        <label>Sala</label>
                        <select 
                            className="input-modal input-valid"
                            value={room?.idRoom || ""} 
                            onFocus={() => {
                                setRoom(undefined);
                            }}

                            onChange={(e) => {
                                
                                const selectedRoom = rooms.find(r => r.idRoom == e.target.value);
                                if (selectedRoom){
                                    setRoom(selectedRoom);
                                    setNewScheduleData({...newScheduleData, room: selectedRoom.idRoom })
                                } else {
                                    setNewScheduleData({ ...newScheduleData, room:"" });
                                }}}
                        >
                            <option value="" disabled>Seleccione una sala</option>
                            {office && filteredRooms.map((room)=>
                                <option key={room.idRoom} value={room.idRoom}>{room.description}</option>
                            )}
                        </select>
                        <div className="error-container">
                        {errors.room && 
                            <div className="error-text">
                                <FaExclamationTriangle className="error-icon"/>{errors.room}
                            </div>}
                        </div>
                    </div>
                    <div className="modal-input-container">
                        <label>Tipo de turno</label>
                        <select 
                            className="input-modal input-valid"
                            value={newScheduleData.allowedType}
                            onChange={(e) => setNewScheduleData({...newScheduleData, allowedType: e.target.value})}
                        >
                            <option value="simple">Simple</option>
                            <option value="taller">Taller</option>
                        </select>
                        <div className="error-container"></div>
                    </div>
                    <div className="modal-input-container">
                        <label>Duración</label>
                        <select 
                            className="input-modal input-valid"
                            value={newScheduleData.duration}
                            onChange={(e) => setNewScheduleData({...newScheduleData, duration: Number(e.target.value)})}
                        >
                            {durations.map((dur) =>
                                <option key={dur} value={dur}>
                                    {dur + " min"}
                                </option>
                            )}
                        </select>
                        <div className="error-container">
                        {errors.duration && 
                            <div className="error-text">
                                <FaExclamationTriangle className="error-icon"/>{errors.duration}
                            </div>}
                        </div>
                    </div>
                    
                    <div className="button-container">
                        <button className="create-button" onClick={()=>{handleSubmit()}}>Crear horario</button>
                    </div>
                </div>
            </div>
        </div>
    
        
    );}else if(!schedule && isProfessional){ //un profesional no puede crear ni eliminar horarios
        return (
            <div className="schedule-modal-overlay" onClick={onClose}>
                <div className="schedule-modal" onClick={(e) => e.stopPropagation()} /* Evita que el clic en el modal cierre el modal */ >
                    <div className="schedule-modal-header">
                        <h2 className="schedule-modal-header-title">Crear un Horario</h2> 
                        <button className="schedule-modal-header-close" onClick={onClose}> <FaXmark/> </button>
                    </div>
                    <div className="schedule-modal-content">
                        <div> Consultar con el administrador del consultorio para poder agregar un horario a su grilla.</div>
                        <div> Desde ya, disculpe las molestias.</div>
                    </div>
                </div>
            </div>
        );
    }
}