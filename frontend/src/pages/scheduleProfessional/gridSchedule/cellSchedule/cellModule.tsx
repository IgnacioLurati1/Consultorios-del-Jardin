import type{ Schedule } from "../../../types.ts"
import "./cellModule.css"

interface cellModuleProps{
    schedule?: Schedule;
    height: number;
    setScheduleModalOpen: (isOpen: boolean) => void; // Función para abrir el modal
    setSelectedSchedule: (schedule: Schedule | undefined) => void; // Función para seleccionar el horario
}

export function CellModule({schedule,height,setScheduleModalOpen,setSelectedSchedule}:cellModuleProps){

    const handleClick = () => {
        setScheduleModalOpen(true);
        setSelectedSchedule(schedule);
    }
    return(
        <div
            className={`hourly-module ${schedule ? schedule.allowedType : "empty"}`}
            style={{ height: `calc(${height*6}vh + ${(height-1)}em)` }} //calculo la altura segun su duracion, le sumo la altura de cada uno (6vh) y la de los margenes 0.5em c/coso
            onClick={handleClick}
        >

            {schedule ? (
                <div className="hourly-module-text">
                <div>{schedule.initialHour} - {schedule.finalHour}</div>
                <div>{schedule.allowedType.charAt(0).toUpperCase()+schedule.allowedType.slice(1)}</div>
        </div>
            ) : (
                <div></div> // módulo vacío
            )}
        </div>
    );
}
