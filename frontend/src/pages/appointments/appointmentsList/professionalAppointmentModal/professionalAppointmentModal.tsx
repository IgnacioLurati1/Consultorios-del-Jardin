
import { useState, useEffect } from "react";
import "./professionalAppointmentModal.css";
import { toast } from "react-toastify";
import { FaXmark } from "react-icons/fa6";
import { FaExclamationTriangle, FaAngleDown } from "react-icons/fa";
import type{ Person} from "../../../types.ts"
import { findAllOfficesByProfessional } from "../../../adminCRUDS/adminOffices/OfficeService.ts";
import { findAllActiveClients } from "../../../adminCRUDS/adminUsers/usersService.ts";
import { findRoomsByOfficeAndProfessional } from "../../../adminCRUDS/adminRooms/RoomService.ts";

interface Office {
    id_office: string;
    closing_time: string;
    description:  string;
    city_id_city: number;
    opening_time: string;
}

interface Room {
    id_room: string;
    description:  string;
    office_id_office: number;
}

interface ProfessionalAppointmentModalProps{
    isOpen: boolean;
    onClose: () => void;
    onCreate: (newAppointmentData: {date: string,initialHour: string,finalHour: string,room: string,type: string,value: number,patientEmail: string}) => void;
    user: Person;
}

const durations: number[] = [15, 30, 60];

function dateToInputString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function sumarMinutos(horaHM: string, minutosExtra: number): string {
    const [h, m] = horaHM.split(":").map(Number);

    const totalMin = h * 60 + m + minutosExtra;

    const newH = Math.floor(totalMin / 60) % 24; // rotación de 24h
    const newM = totalMin % 60;

    return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

function minutosValidos(horaHM: string): boolean {
    if (!horaHM) return false;

    const mm = Number(horaHM.split(":")[1]);
    return mm === 0 || mm === 15 || mm === 30 || mm === 45;
}

export function isDateValid(dateYYYYMMDD: string): boolean {
    const [y, m, d] = dateYYYYMMDD.split("-").map(Number);
    const inputDate = new Date(y, m - 1, d);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return inputDate.getTime() >= today.getTime();
}

export function isHourValidToday(timeHHMM: string): boolean {
    const [hh, mm] = timeHHMM.split(":").map(Number);

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const inputMinutes = hh * 60 + mm;

    return inputMinutes >= nowMinutes;
}

export function isToday(dateYYYYMMDD: string): boolean {
    const today = new Date();
    const input = new Date(dateYYYYMMDD);

    return (
        today.getFullYear() === input.getFullYear() &&
        today.getMonth() === input.getMonth() &&
        today.getDate() === input.getDate()
    );
}


export function ProfessionalAppointmentModal({isOpen, onClose,onCreate, user}: ProfessionalAppointmentModalProps) {
    // State para los campos del formulario
    const [newAppointmentData, setNewAppointmentData] = useState({ date: "", initialHour: "", finalHour: "",type: "", room:"",value: 0, patientEmail: ""   });
    
    const [duration, setDuration] = useState<number>(60);

    const [patients, setPatients] = useState<Person[] | []>([]);
    const [filteredPatients, setFilteredPatients] = useState<Person[]>([]);
    const [patientSelector, setPatientSelector] = useState(false);
    const [patientInputValue, setPatientInputValue] = useState("");
    const [patient, setPatient] = useState<Person | undefined>(undefined);

    const [office, setOffice] = useState< Office | undefined>(undefined);
    const [offices, setOffices] = useState< Office[]>([]);

    const [room, setRoom] = useState< Room | undefined>(undefined);
    const [rooms, setRooms] = useState< Room[]>([]);
    const [filteredRooms, setFilteredRooms] = useState< Room[]>([]);

    const [errors, setErrors] = useState<{date?:string,initialHour?:string , office?: string, room?: string, patient?: string}>({});

    useEffect(() => {
        if (isOpen) { // Si se abre el modal para crear un nuevo turno
            const today = new Date();
            setNewAppointmentData({ date: dateToInputString(today), initialHour: "", finalHour: "",type: "simple", room:"",value: 0, patientEmail: ""   });
            setPatient(undefined);
            setPatientInputValue("");
            setPatientSelector(false);
            setDuration(60);
            setOffice(undefined);
            setRoom(undefined);
            setErrors({});
        }
    }, [ isOpen]);

    useEffect(() => {
        findAllOfficesByProfessional(user.email)
        .then(data => {
            setOffices(data);
        })
        .catch(err => {
            toast.error("Error cargando consultorios:", err);
        });
    }, [isOpen]);

    useEffect(() => {
        findAllActiveClients()
        .then(data => {
            setPatients(data);
            setFilteredPatients(data);
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
    
            if(!newAppointmentData.initialHour.trim()){
                newErrors.initialHour = "Ingrese hora de inicio"
            }
            if(!minutosValidos(newAppointmentData.initialHour)){
                newErrors.initialHour = "Minutos inválidos (solo 00, 15, 30 o 45)"
            }
            if(!(newAppointmentData.initialHour > "07:59" || newAppointmentData.initialHour < "20:01")){
                newErrors.initialHour = "Hora de inicio inválida"
            }
            if(!isDateValid(newAppointmentData.date)){
                newErrors.date = "Fecha inválida"
            }

            const today =  new Date().toLocaleDateString("en-CA");
            if(newAppointmentData.date === today && !isHourValidToday(newAppointmentData.initialHour)){
                newErrors.initialHour = "Hora de inicio inválida"
            }
            if(!office){
                newErrors.office = "El consultorio es obligatorio"
            }
            if(!newAppointmentData.room){
                newErrors.room = "La sala es obligatoria"
            }
            if(!newAppointmentData.patientEmail){
                newErrors.patient = "El paciente es obligatorio"
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
    
            if(onCreate){
                newAppointmentData.value = 0;
                onCreate({ date: newAppointmentData.date, initialHour: newAppointmentData.initialHour, finalHour: newAppointmentData.finalHour, room: newAppointmentData.room, type: newAppointmentData.type, value: newAppointmentData.value, patientEmail: newAppointmentData.patientEmail });
            }
        }
    function FilterPatients(text: string){
        const lowertext = text.toLocaleLowerCase();
        const filtered = patients.filter( pat => pat.email.toLocaleLowerCase().includes(lowertext) 
        || pat.name.toLocaleLowerCase().includes(lowertext) 
        ||pat.surname.toLocaleLowerCase().includes(lowertext))
        setFilteredPatients(filtered)
    }
    function FindRooms(officeId: string, professionalEmail: string){
        findRoomsByOfficeAndProfessional(officeId, professionalEmail)
        .then(data => {
            setRooms(data);
            setFilteredRooms(data);
        })
        .catch(err => {
            toast.error("Error cargando salas:", err);
        });
    }

    if (!isOpen) return null;
    return (
        <div className="prof-appo-modal-overlay" onClick={onClose}>
            <div className="prof-appo-modal" onClick={(e) => e.stopPropagation()}  onKeyDown={handleKeyDown}>
                <div className="prof-appo-modal-header">
                    <h2 className="prof-appo-modal-header-title">Agendar un Turno</h2> 
                    <button className="prof-appo-modal-header-close" onClick={onClose}> <FaXmark/> </button>
                </div>
                <div className="prof-appo-modal-content">
                    <div className="prof-appo-modal-input-container">
                        <label>Fecha</label>
                        <input 
                            type="date" 
                            min={new Date().toISOString().split("T")[0]}
                            className={`prof-appo-modal-input ${false? "input-error" : "input-valid"}`} 
                            value={newAppointmentData.date}
                            onChange={(e) => 
                                setNewAppointmentData({...newAppointmentData, date: e.target.value})
                            }
                        />
                        <div className="prof-appo-modal-error-container">
                            {errors.date &&
                                <div className="prof-appo-modal-error-text">
                                    <FaExclamationTriangle className="prof-appo-modal-error-icon"/>{errors.date}
                                </div>
                            }
                        </div>
                    </div>
                    <div className="prof-appo-modal-time-input-container">
                        <div className="prof-appo-modal-input-container">
                            <label>Hora inicio</label>
                            <input 
                                type="time" 
                                className={`prof-appo-modal-input ${false? "input-error" : "input-valid"}`} 
                                value={newAppointmentData.initialHour}
                                step="900"
                                onChange={(e) => {
                                    const value = e.target.value; // HH:MM
                                    const [hh, mm] = value.split(":").map(Number);
                                    let durationAux = 0;

                                    if (mm === 0) {
                                        setDuration(60); 
                                        durationAux = 60
                                    };
                                    if (mm === 15) {
                                        setDuration(15); 
                                        durationAux = 15
                                    };
                                    if (mm === 30) {
                                        setDuration(30); 
                                        durationAux = 30
                                    };
                                    if (mm === 45) {
                                        setDuration(15); 
                                        durationAux = 15
                                    };

                                    const newFinal = sumarMinutos(value, durationAux);

                                    setNewAppointmentData(prev => ({
                                        ...prev,
                                        initialHour: value,
                                        finalHour: newFinal,
                                    }));
                                }}
                            />
                            <div className="prof-appo-modal-error-container">
                                {errors.initialHour &&
                                    <div className="prof-appo-modal-error-text">
                                        <FaExclamationTriangle className="prof-appo-modal-error-icon"/>{errors.initialHour}
                                    </div>
                                }
                            </div>
                        </div>
                        <div className="prof-appo-modal-input-container">
                            <label>Duración</label>
                            <select 
                                className="prof-appo-modal-input input-valid"
                                value={duration}
                                onChange={(e) => {

                                    setDuration(Number(e.target.value))}}
                            >
                                {durations.map((dur) =>
                                    <option key={dur} value={dur}>
                                        {dur + " min"}
                                    </option>
                                )}
                            </select>
                            <div className="prof-appo-modal-error-container"></div>
                        </div>
                    </div>
                    
                    <div className="prof-appo-modal-input-container">
                        <label>Profesional</label>
                        <input 
                            type="text" 
                            className="prof-appo-modal-input input-valid" 
                            value={user.surname + ", " + user.name} disabled 
                        /> 
                        <div className="prof-appo-modal-error-container"></div>
                    </div>
                    <div className="prof-appo-modal-input-container">
                        <label>Consultorio</label>
                        <select 
                            className="prof-appo-modal-input input-valid"
                            value={office?.id_office || ""} 
                            onFocus={() => {
                                setOffice(undefined);
                                setRoom(undefined);
                                setFilteredRooms(rooms);
                            }}

                            onChange={(e) => {
                                const selectedOffice = offices.find(r => r.id_office == e.target.value);
                                if (selectedOffice){
                                    setOffice(selectedOffice);
                                    FindRooms(selectedOffice.id_office, user.email);
                                }
                            }}
                        >
                            <option key={-1} value="" disabled>Seleccione un consultorio</option>
                            {offices.map((office)=>
                                <option key={office.id_office} value={office.id_office}> {office.description} </option>
                            )}
                        </select>
                        <div className="prof-appo-modal-error-container">
                        {errors.office && 
                            <div className="prof-appo-modal-error-text">
                                <FaExclamationTriangle className="prof-appo-modal-error-icon"/>{errors.office}
                            </div>}
                        </div>
                    </div>
                    <div className="prof-appo-modal-input-container">
                        <label>Sala</label>
                        <select 
                            className="prof-appo-modal-input input-valid"
                            value={room?.id_room || ""} 
                            onFocus={() => {
                                setRoom(undefined);
                            }}

                            onChange={(e) => {
                                
                                const selectedRoom = rooms.find(r => r.id_room == e.target.value);
                                if (selectedRoom){
                                    setRoom(selectedRoom);
                                    setNewAppointmentData({...newAppointmentData, room: selectedRoom.id_room })
                                } else {
                                    setNewAppointmentData({ ...newAppointmentData, room:"" });
                                }}}
                        >
                            <option value="" disabled>Seleccione una sala</option>
                            {office && filteredRooms.map((room)=>
                                <option key={room.id_room} value={room.id_room}>{room.description}</option>
                            )}
                        </select>
                        <div className="prof-appo-modal-error-container">
                        {errors.room && 
                            <div className="prof-appo-modal-error-text">
                                <FaExclamationTriangle className="prof-appo-modal-error-icon"/>{errors.room}
                            </div>}
                        </div>
                    </div>
                    <div className="prof-appo-modal-input-container">
                        <label>Tipo de turno</label>
                        <select 
                            className="prof-appo-modal-input input-valid"
                            value={newAppointmentData.type}
                            
                            onChange={(e) => setNewAppointmentData({...newAppointmentData, type: e.target.value})}
                        >
                            <option key={"simple"} value="simple">Simple</option>
                            <option key={"taller"} value="taller">Taller</option>
                        </select>
                        <div className="prof-appo-modal-error-container"></div>
                    </div>

                    <div className="prof-appo-modal-input-container">
                        <label>Paciente</label>
                        <div className="prof-appo-modal-form-select" onClick={() => setPatientSelector(!patientSelector)}>
                            <input 
                                className={`prof-appo-modal-input ${false? "input-error" : "input-valid"}`}  
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
                            <FaAngleDown className={patientSelector ? "prof-appo-modal-icon rotated" : "prof-appo-modal-icon"} />
                            {patientSelector && (
                        <ul className={"prof-appo-modal-filter-list" + (patientSelector ? " active" : " disabled")}>
                                {filteredPatients.length > 0 ? (
                                    filteredPatients.map((patient) => (
                                        <li 
                                            className="prof-appo-modal-filter-list-item" 
                                            key={patient.email} 
                                            onClick={() => { 
                                                setPatient(patient);
                                                setNewAppointmentData({...newAppointmentData, patientEmail: patient.email });
                                                setPatientInputValue(`${patient.surname}, ${patient.name} - ${patient.email}`);
                                                setPatientSelector(false);
                                            }}
                                        >
                                            {patient.surname}, {patient.name} - {patient.email}
                                        </li>
                                    ))
                                ) : (
                                    <li className="prof-appo-modal-filter-list-item prof-appo-modal-no-results">No se encontraron resultados</li>
                                )}
                            </ul>
                        )}
                        </div>
                            <div className="prof-appo-modal-error-container">
                            {errors.patient && 
                                <div className="prof-appo-modal-error-text">
                                    <FaExclamationTriangle className="appointment-input-error-icon"/>{errors.patient}
                                </div>
                            }
                        </div>
                    </div>
                    
                    <div className="prof-appo-modal-button-container">
                        <button className="prof-appo-modal-create-button" onClick={()=>{handleSubmit()}}>Agendar turno</button>
                    </div>
                </div>
            </div>
        </div>
    );
}