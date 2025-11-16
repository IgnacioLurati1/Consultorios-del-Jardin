import type{ cellModuleProps } from "../../../appointmentTypes.ts"
import "./appointmentCellModule.css"

export function diffInMinutes(time1: string, time2: string): number {
    const [h1, m1] = time1.split(":").map(Number);
    const [h2, m2] = time2.split(":").map(Number);

    const total1 = h1 * 60 + m1;
    const total2 = h2 * 60 + m2;

    return total1 - total2;
}

export function AppointmentCellModule({appointment,height, setAppointmentModalOpen,setSelectedAppointment}:cellModuleProps){

    const handleClick = () => {
        if (setAppointmentModalOpen){
            setAppointmentModalOpen(true);
            setSelectedAppointment(appointment);
        }
    }
    return(
        <div
            className={`appointment-hourly-module ${appointment ? appointment.type : "empty"}`}
            style={{ height: `calc(${height*5}vh + ${((height*0.4)-0.4)}em)` }} //calculo la altura segun su duracion, le sumo la altura de cada uno (6vh) y la de los margenes 0.5em c/coso
            onClick={handleClick}
        >

            {appointment ? (
                <div className="appointment-hourly-module-text">
                    <div>{appointment.initialHour} - {diffInMinutes(appointment.finalHour, appointment.initialHour)} min</div>
                </div>
            ) : (
                <div></div> // módulo vacío
            )}
        </div>
    );
}
