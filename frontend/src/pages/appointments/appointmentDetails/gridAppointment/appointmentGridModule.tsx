import { useState } from "react";
import type{ columnModuleProps } from "../../appointmentTypes.ts"
import {AppointmentCellModule} from "./appointmentCellModule/appointmentCellModule.tsx"
import "./appointmentGridModule.css"
import { FaAngleDown, FaGreaterThan, FaLessThan} from "react-icons/fa";

function diffInMinutes(time1: string, time2: string): number {
    const [h1, m1] = time1.split(":").map(Number);
    const [h2, m2] = time2.split(":").map(Number);

    const total1 = h1 * 60 + m1;
    const total2 = h2 * 60 + m2;

    return total1 - total2;
}

function getStartOfWeek(date: Date): Date {
    const day = date.getDay(); // 0 = domingo, 6 = sábado
    const monday = new Date(date);

    if (day === 6 || day === 0) {
        // sábado (6) o domingo (0) → próximo lunes
        const diff = (day === 6 ? 2 : 1);
        monday.setDate(date.getDate() + diff);
    } else {
        // lunes a viernes → lunes de esta semana
        const diff = 1 - day;
        monday.setDate(date.getDate() + diff);
    }

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

function isSameDay(d1: any, d2: any): boolean {
    const date1 = new Date(d1);
    const date2 = new Date(d2);

    //console.log(date1, date2);

    return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
    );
}

function hoursToTime(hours: number): string {
    const h = Math.floor(hours);
    const decimalPart = hours - h;
    const m = Math.round(decimalPart * 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function AppointmentGridModule({ appointments, showSimple, showTaller,setAppointmentModalOpen, setSelectedAppointment}: columnModuleProps) {
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

    const filteredAppointments = appointments.filter((a) => {
        if (a.type === "simple" && !showSimple) return false;
        if (a.type === "taller" && !showTaller) return false;
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

                                while (hourId < (13)) {
                                    const currentHour = 8 + hourId;
                                    const currentHourStr = hoursToTime(currentHour);

                                    const appointment = filteredAppointments.find(
                                    (a) => isSameDay(a.date, day) && a.initialHour === currentHourStr);
                                    
                                    const today = new Date();
                                    if (appointment && day>=today) {
                                        
                                        cells.push(<AppointmentCellModule key={`${day}-${appointment.initialHour.split(":")[0]}:${appointment.initialHour.split(":")[1]}`} appointment={appointment} height={(diffInMinutes(appointment.finalHour, appointment.initialHour))/30} setAppointmentModalOpen={setAppointmentModalOpen} setSelectedAppointment={setSelectedAppointment}/>);
                                        hourId += diffInMinutes(appointment.finalHour, appointment.initialHour)/60; // salta minutos

                                    } else {
                                        // Buscar la próxima cita del día para calcular el tamaño de la celda vacía
                                        const nextAppointment = filteredAppointments.find(
                                            (a) => isSameDay(a.date, day) && a.initialHour > currentHourStr
                                        );
                                        
                                        let emptySlotDuration = 0.5;
                                        
                                        if (nextAppointment) {
                                            const minutesUntilNext = diffInMinutes(nextAppointment.initialHour, currentHourStr);
                                            emptySlotDuration = Math.min(minutesUntilNext / 60, 0.5);
                                        } else {
                                            const decimal = hourId - Math.floor(hourId);
                                            if (decimal === 0.25 || decimal === 0.75) {
                                                emptySlotDuration = 0.25;
                                            }
                                        }
                                        
                                        cells.push(<AppointmentCellModule key={`${day}-${currentHourStr}`} appointment={undefined} height={emptySlotDuration * 2} setAppointmentModalOpen={undefined} setSelectedAppointment={setSelectedAppointment}/>);
                                        hourId += emptySlotDuration;
                                    }
                                }
                                return cells;

                            })()}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}
