import type{ Schedule } from "../../types.ts"
import {CellModule} from "./cellSchedule/cellModule.tsx"
import "./gridModule.css"

interface columnModuleProps{
    schedules: Schedule[];
    daysSpanish: string[];
    openingTime: string;
    closingTime: string;
}

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

export function GridModule({ schedules, daysSpanish, openingTime, closingTime }: columnModuleProps) {
    const openedHours = diffHours(openingTime, closingTime)
    const startHour = stringHourToNumber(openingTime);   // hora de apertura del office

    return (
        <div className="schedule">
            {daysSpanish.map((day, id) => (
                <div className="day-column" key={id}>
                    <div className="day-title">
                        {day.charAt(0).toUpperCase() + day.slice(1)}
                    </div>

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

                                cells.push(<CellModule key={`${day}-${currentHourStr}`} schedule={schedule} height={difference}/>);
                                
                                hourId += difference; // salta horas
                            } else {
                                cells.push(<CellModule key={`${day}-${currentHourStr}`} schedule={undefined}height={1}/>);
                                hourId++;
                            }
                        }
                        return cells;

                    })()}
                </div>
            ))}
        </div>
    );
}
