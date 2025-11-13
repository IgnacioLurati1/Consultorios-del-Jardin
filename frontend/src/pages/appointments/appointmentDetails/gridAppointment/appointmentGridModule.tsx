import { useState } from "react";
import type{ columnModuleProps } from "../../appointmentTypes.ts"
import {AppointmentCellModule} from "./appointmentCellModule/appointmentCellModule.tsx"
import "./appointmentGridModule.css"
import { FaAngleDown, FaGreaterThan, FaLessThan} from "react-icons/fa";

function diffHours(open: string, close: string): number { // PODRIA IR EN EL SERVICIO
    
    const [h1, m1] = open.split(":").map(Number);
    const [h2, m2] = close.split(":").map(Number);

    const date1 = new Date(0, 0, 0, h1, m1);
    const date2 = new Date(0, 0, 0, h2, m2);

    const diffMs = date2.getTime() - date1.getTime();

    return diffMs / (1000 * 60 * 60); // diferencia en horas
}

function getStartOfWeek(date: Date): Date {
    const day = date.getDay(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
    const diff = (day === 0 ? -6 : 1 - day); // si es domingo, retrocedé 6 días
    const monday = new Date(date);
    monday.setDate(date.getDate() + diff);
    return monday;
}

function getWeekDays(date: Date): Date[] { //genera los 7 días de esa semana
    const monday = getStartOfWeek(date);
    const days: Date[] = [];

    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        days.push(d);
    }
    return days;
}

// Convierte minutos totales a string "HH:MM"
function minutesToTime(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function AppointmentGridModule({ schedules, showSimple, showTaller,setAppointmentModalOpen, setSelectedSchedule, setSelectedDate}: columnModuleProps) {
    const [showDay, setShowDay] = useState<boolean[]>([false,false,false,false,false,false]); // estado para mostrar mas info del dia
    const [currentDate, setCurrentDate] = useState(new Date());

    function moveWeek(direction: 1 | -1): void {
        setCurrentDate((prevDate) => {
            const newDate = new Date(prevDate); // copia la anterior
            newDate.setDate(newDate.getDate() + direction * 7); // mueve 7 días
            return newDate;
        });
    }

    const weekDays = getWeekDays(currentDate);

    const filteredSchedules = schedules.filter((s) => {
        if (s.allowedType === "simple" && !showSimple) return false;
        if (s.allowedType === "taller" && !showTaller) return false;
        return true;
    });

    return (
        <>
            <div className="appointment-table-title">
                <div className="appointment-table-title-arrow left" onClick={()=>(moveWeek(-1))}><FaLessThan className="appointment-button-month" size={20} /></div>
                
                <div className="appointment-table-title-month">{(currentDate.toLocaleString("es-ES", { month: "long" })).charAt(0).toUpperCase() + (currentDate.toLocaleString("es-ES", { month: "long" })).slice(1)}</div>

                <div className="appointment-table-title-arrow right" onClick={()=>(moveWeek(1))}><FaGreaterThan className="appointment-button-month" size={20} /></div>
            </div>
            <div className="appointment-schedule">
                {weekDays.map((day, id) => (
                    <div className="appointment-day-column" key={id}>
                        <div className="appointment-day-title" key={day.toISOString()} onClick={() => {
                            const newShowDay = [...showDay];
                            newShowDay[id] = !newShowDay[id];
                            setShowDay(newShowDay);
                        }}>
                            <div className="appointment-day-title-text">
                                <div>{(day.toLocaleDateString("es-ES", { weekday: "long"})).charAt(0).toUpperCase() + (day.toLocaleDateString("es-ES", { weekday: "short"})).slice(1)}</div>
                                <div>{(day.toLocaleDateString("es-ES", {day: "numeric"})).charAt(0).toUpperCase() + (day.toLocaleDateString("es-ES", {day: "numeric"})).slice(1)}</div>
                            </div>
                            <div className={`appointment-show-more-icon ${showDay[id] ? "appointment-rotated" : ""}`}><FaAngleDown/></div> {/*para el responsive*/}
                        </div>

                        <div className={`appointment-day-cells ${showDay[id] ? "appointment-expanded" : ""}`}>
                            {(() => {
                                const cells: React.ReactNode[] = []; //array de componentes de react representa la columna
                                let hourId = 0;

                                while (hourId < 13) {
                                    const currentHour = 8 + hourId;
                                    const currentHourStr = String(currentHour).padStart(2, "0") + ":00";

                                    const schedule = filteredSchedules.find(
                                    (s) =>
                                        s.day.toLowerCase() === (day.toLocaleDateString("es-ES", { weekday: "long"}).normalize("NFD").replace(/[\u0300-\u036f]/g, "")) &&
                                        s.initialHour === currentHourStr
                                    );
                                    const today = new Date();
                                    if (schedule && day>=today) {

                                        const difference = diffHours(schedule.initialHour,schedule.finalHour);
                                        let minuteId = 0;

                                        while (minuteId < (difference*60)) {
                                            
                                            const currentMinute = currentHour*60 + minuteId;
                                            const currentTime = minutesToTime(currentMinute) 
                                            const dayTime = new Date(day);
                                            const [hours, minutes] = currentTime.split(":").map(Number);
                                            dayTime.setHours(hours, minutes, 0, 0);

                                            cells.push(<AppointmentCellModule key={`${day}-${currentHourStr}-${currentTime}`} date={dayTime} time={currentTime} schedule={schedule} height={schedule.duration/30} setAppointmentModalOpen={setAppointmentModalOpen} setSelectedSchedule={setSelectedSchedule} setSelectedDate={setSelectedDate}/>);
                                            
                                            minuteId += (schedule.duration);
                                        }
                                        
                                        hourId += difference; // salta horas
                                    } else {
                                        cells.push(<AppointmentCellModule key={`${day}-${currentHourStr}`} date={day} time={undefined} schedule={undefined} height={1} setAppointmentModalOpen={undefined} setSelectedSchedule={setSelectedSchedule} setSelectedDate={setSelectedDate}/>);
                                        hourId += 0.5; // avanza 30 minutos
                                    }
                                }
                                return cells;

                            })()}

                                <AppointmentCellModule date={day}  time={undefined} schedule={undefined} height={1} setAppointmentModalOpen={setAppointmentModalOpen} setSelectedSchedule={setSelectedSchedule} setSelectedDate={setSelectedDate} className="appointment-last-empty" />
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}
