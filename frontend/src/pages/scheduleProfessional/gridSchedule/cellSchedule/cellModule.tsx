import type{ Schedule } from "../../../types.ts"
import "./cellModule.css"

interface cellModuleProps{
    schedule: Schedule|undefined;
    height: number;
}

export function CellModule({schedule,height}:cellModuleProps){
    return(
        <div
            className={`hourly-module ${schedule ? schedule.allowedType : "empty"}`}
            style={{ height: `calc(${height*6}vh + ${(height-1)}em)` }} //calculo la altura segun su duracion, le sumo la altura de cada uno (6vh) y la de los margenes 0.5em c/coso
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
