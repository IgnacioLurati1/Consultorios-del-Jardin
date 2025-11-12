import type{ cellModuleProps } from "../../../appointmentTypes.ts"
import "./appointmentCellModule.css"

export function AppointmentCellModule({cellKey,time,schedule,height, setAppointmentModalOpen, setSelectedSchedule, setSelectedKey}:cellModuleProps){

    const handleClick = () => {
        setAppointmentModalOpen(true);
        setSelectedSchedule(schedule);
        setSelectedKey(cellKey)
        console.log("Clicked cell:", cellKey);
    }
    return(
        <div
            className={`appointment-hourly-module ${schedule ? schedule.allowedType : "empty"}`}
            style={{ height: `calc(${height*5}vh + ${((height*0.4)-0.4)}em)` }} //calculo la altura segun su duracion, le sumo la altura de cada uno (6vh) y la de los margenes 0.5em c/coso
            onClick={handleClick}
        >

            {schedule ? (
                <div className="appointment-hourly-module-text">
                    <div>{time} - {schedule.duration} min</div>
                </div>
            ) : (
                <div></div> // módulo vacío
            )}
        </div>
    );
}
