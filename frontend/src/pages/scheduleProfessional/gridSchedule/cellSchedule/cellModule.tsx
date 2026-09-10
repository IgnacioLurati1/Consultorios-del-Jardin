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
            // Las horas que dura, más los espacios entre ellas que se come al ocuparlas. Las dos
            // medidas son las de .schedule, las mismas de la columna de las horas.
            style={{ height: `calc(${height} * var(--hour-h, 5vh) + ${Math.max(0, height - 1)} * var(--hour-gap, 2px))` }}
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
