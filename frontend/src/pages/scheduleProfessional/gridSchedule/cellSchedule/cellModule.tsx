import type{ cellModuleProps } from "../../scheduleTypes.ts"
import "./cellModule.css"

export function CellModule({cellKey,schedule,height,setScheduleModalOpen,setSelectedSchedule, setSelectedKey, showProfessional, readOnly, canCreate = true}:cellModuleProps){

    // Con el profesional deshabilitado el hueco libre no lleva a ningún lado, pero la
    // franja cargada sigue abriendo: es por donde se la borra.
    const locked = readOnly || (!schedule && !canCreate);

    const handleClick = () => {
        if (locked) return; // en modo consultorio no se abre el modal de alta/baja
        setScheduleModalOpen(true);
        setSelectedSchedule(schedule);
        setSelectedKey(cellKey)
    }
    return(
        <div
            className={`hourly-module ${schedule ? "taken" : "empty"}${locked ? " read-only" : ""}`}
            style={{ height: `calc(${height*5}vh + ${((height*0.4)-0.4)}em)` }} //calculo la altura segun su duracion, le sumo la altura de cada uno (6vh) y la de los margenes 0.5em c/coso
            onClick={handleClick}
        >

            {schedule ? (
                <div className="hourly-module-text">
                <div>{schedule.initialHour} - {schedule.finalHour}</div>
                <div>{showProfessional ? `${schedule.person.surname}, ${schedule.person.name}` : schedule.room.description}</div>
        </div>
            ) : (
                <div></div> // módulo vacío
            )}
        </div>
    );
}
