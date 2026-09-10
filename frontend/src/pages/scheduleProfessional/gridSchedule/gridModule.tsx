import { useState } from "react";
import type{ columnModuleProps } from "../scheduleTypes.ts"
import {CellModule} from "./cellSchedule/cellModule.tsx"
import "./gridModule.css"
import { FaAngleDown } from "react-icons/fa";

function diffHours(open: string, close: string): number { // PODRIA IR EN EL SERVICIO

    const [h1, m1] = open.split(":").map(Number);
    const [h2, m2] = close.split(":").map(Number);

    const date1 = new Date(0, 0, 0, h1, m1);
    const date2 = new Date(0, 0, 0, h2, m2);

    const diffMs = date2.getTime() - date1.getTime();

    return diffMs / (1000 * 60 * 60); // diferencia en horas
}

function stringHourToNumber(hour: string): number {
    const [hoursString] = hour.split(':');
    const hoursNumber = parseInt(hoursString, 10);
    return hoursNumber;
}

export function GridModule({ schedules, daysSpanish, openingTime, closingTime, setScheduleModalOpen, setSelectedSchedule, setSelectedKey, showProfessional, readOnly, canCreate}: columnModuleProps) {
    const openedHours = diffHours(openingTime, closingTime)
    const startHour = stringHourToNumber(openingTime);   // hora de apertura del office
    const [showDay, setShowDay] = useState<boolean[]>([false,false,false,false,false,false]); // estado para mostrar mas info del dia

    // Una por fila, desde la apertura. Sin esto, a qué hora era una fila solo se sabía si
    // justo había un módulo encima que lo dijera.
    const hours = Array.from({ length: Math.max(0, Math.ceil(openedHours)) }, (_, index) =>
        String(startHour + index).padStart(2, "0") + ":00"
    );

    return (
        <div className="schedule">
            {/* La columna de las horas. Usa las mismas clases que un día, así el encabezado y
                el margen de arriba miden lo mismo, y cada rótulo mide lo mismo que una celda
                de una hora (ver las variables de .schedule). En celular no va: ahí cada día se
                pliega y los módulos ya dicen su horario. */}
            <div className="day-column hours-column" aria-hidden="true">
                <div className="day-title hours-title">Hora</div>
                <div className="day-cells hours-cells">
                    {hours.map((hour) => (
                        <div className="hour-label" key={hour}>
                            {hour}
                        </div>
                    ))}
                </div>
            </div>

            {daysSpanish.map((day, id) => (
                <div className="day-column" key={id}>
                    <div className="day-title" onClick={() => {
                        const newShowDay = [...showDay];
                        newShowDay[id] = !newShowDay[id];
                        setShowDay(newShowDay);
                    }}>
                        {day.charAt(0).toUpperCase() + day.slice(1)}
                        <div className={`show-more-icon ${showDay[id] ? "rotated" : ""}`}><FaAngleDown/></div>
                    </div>

                    <div className={`day-cells ${showDay[id] ? "expanded" : ""}`}>
                        {(() => {
                            const cells: React.ReactNode[] = []; //array de componentes de react representa la columna
                            let hourId = 0;

                            while (hourId < openedHours) {
                                const currentHour = startHour + hourId;
                                const currentHourStr = String(currentHour).padStart(2, "0") + ":00";

                                const schedule = schedules.find(
                                (s) =>
                                    s.day.toLowerCase() === day.toLowerCase() &&
                                    s.initialHour === currentHourStr
                                );

                                if (schedule) {
                                    const difference = diffHours(schedule.initialHour,schedule.finalHour);

                                    cells.push(<CellModule key={`${day}-${currentHourStr}`} cellKey={`${day}-${currentHourStr}`} schedule={schedule} height={difference} setScheduleModalOpen={setScheduleModalOpen} setSelectedSchedule={setSelectedSchedule} setSelectedKey={setSelectedKey} showProfessional={showProfessional} readOnly={readOnly} canCreate={canCreate}/>);

                                    hourId += difference; // salta horas
                                } else {
                                    cells.push(<CellModule key={`${day}-${currentHourStr}`} cellKey={`${day}-${currentHourStr}`} schedule={undefined} height={1} setScheduleModalOpen={setScheduleModalOpen} setSelectedSchedule={setSelectedSchedule} setSelectedKey={setSelectedKey} readOnly={readOnly} canCreate={canCreate}/>);
                                    hourId++;
                                }
                            }
                            return cells;

                        })()}

                            <CellModule cellKey={`${day}-${""}`} schedule={undefined} height={1} setScheduleModalOpen={setScheduleModalOpen} setSelectedSchedule={setSelectedSchedule} setSelectedKey={setSelectedKey} className="last-empty" readOnly={readOnly} canCreate={canCreate} />
                    </div>
                </div>
            ))}
        </div>
    );
}
