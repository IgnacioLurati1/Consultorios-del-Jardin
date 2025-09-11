import "./scheduleProfessional.css";
import {NavZone} from "../../components/navZone/NavZone";
import { GridModule } from "./gridSchedule/gridModule.tsx";
import type{ Person, Schedule, Duration } from "../types.ts"
import { GridFilter } from "./gridFilter/gridFilter.tsx";
import { useEffect, useState } from "react";
import { ScheduleModal } from "./scheduceModal/scheduleModal.tsx";
import {findAllProfessionals, findProfessionalSchedules} from "./scheduleServices.ts"
import { toast } from "react-toastify/unstyled";

const durations: Duration[] = [
  { idDuration: "1", duration: "15" },
  { idDuration: "2", duration: "30" },
  { idDuration: "3", duration: "45" },
  { idDuration: "4", duration: "60" },
];

const daysSpanish: string[] = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
];
const openingTime = "08:00"
const closingTime = "21:00"


export function ScheduleProfessional(){

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | undefined>(undefined);
  const [professionalsList, setProfessionalsList] = useState<Person[] | []>([]);
  const [professional, setProfesional] = useState<Person | undefined>(undefined);
  const [schedules, setSchedules] = useState<Schedule[] | []>([]);

  useEffect(() => {
    findAllProfessionals()
    .then(data => {
        setProfessionalsList(data);
    })
    .catch(err => {
        toast.error("Error cargando profesionales:", err);
    });
  }, []);

  useEffect(() => {
    if(professional){
      findProfessionalSchedules(professional.email)
      .then(data => {
          console.log("Horarios cargados:", data);
          setSchedules(data);
      })
      .catch(err => {
          toast.error("Error cargando horarios:", err);
      });
    }
  }, [professional]);

  if(!professional){
    return (
      <div className="schedule-professional-container">
        <div className="upper-container">
          <NavZone title="Seleccionar Profesional en los filtros"/>
          <GridFilter setProfessional={setProfesional} professionals={professionalsList}/>
        </div>
      </div>
    );
  } else {
      return (
        <div className="schedule-professional-container">
          <div className="schedule-subcontainer">
            <div className="upper-container">
                <NavZone title={`Horarios de ${professional.name}, ${professional.surname}`}/>
                <GridFilter setProfessional={setProfesional} professionals={professionalsList}/>
            </div>
            <div className="schedule-container">
              <GridModule schedules={schedules} daysSpanish={daysSpanish} openingTime={openingTime} closingTime={closingTime} setScheduleModalOpen={setScheduleModalOpen} setSelectedSchedule={setSelectedSchedule}/>
            </div>
          </div>
          <ScheduleModal isOpen={scheduleModalOpen} onClose={() => setScheduleModalOpen(false)} schedule={selectedSchedule} />

        </div>
      );
  }
};

