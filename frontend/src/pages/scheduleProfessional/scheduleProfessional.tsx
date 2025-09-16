import "./scheduleProfessional.css";
import {NavZone} from "../../components/navZone/NavZone";
import { GridModule } from "./gridSchedule/gridModule.tsx";
import type{ Person, Schedule, TokenPayload} from "../types.ts"
import { GridFilter } from "./gridFilter/gridFilter.tsx";
import { useEffect, useState } from "react";
import { ScheduleModal } from "./scheduceModal/scheduleModal.tsx";
import {findAllProfessionals, findProfessionalSchedules, } from "./scheduleServices.ts"
import { toast } from "react-toastify/unstyled";
import { jwtDecode } from "jwt-decode";
import { findPerson } from "../commonServices.ts";

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
  const [professional, setProfessional] = useState<Person | undefined>(undefined);
  const [schedules, setSchedules] = useState<Schedule[] | []>([]);
  const [isProfessional, setIsProfessional] = useState(false)

  useEffect(() => {

    const storedToken=localStorage.getItem("token")
    if (!storedToken) return;
    const decoded = jwtDecode<TokenPayload>(storedToken);
    console.log(decoded)
    if(decoded.type === "professional"){
      setIsProfessional(true)
      const email = decoded.email
      findPerson(email)
      .then(data => {
        if (!data) {
        toast.error("No se encontró el profesional");
        return;
        }
        setProfessional(data);
      })
      .catch(err => toast.error(`Error al cargar al profesional: ${err.message}`));
    }
    else
      {
    findAllProfessionals()
    .then(data => {
        setProfessionalsList(data);
    })
    .catch(err => {
        toast.error("Error cargando profesionales:", err);
    });
    }
  }, []);

  useEffect(() => {
    if(professional){
      findProfessionalSchedules(professional.email)
      .then(data => {
          setSchedules(data);
      })
      .catch(err => {
          toast.error(`Error cargando horarios:" ${err.message}`);
      });
    }
  }, [professional]);

  if(professional && isProfessional){
    console.log(professional)
    return (
        <div className="schedule-professional-container">
          <div className="schedule-subcontainer">
            <div className="upper-container">
                <NavZone title={`Horarios de ${professional.name}, ${professional.surname}`}/>
                <GridFilter setProfessional={setProfessional}/>
            </div>
            <div className="schedule-container">
              <GridModule schedules={schedules} daysSpanish={daysSpanish} openingTime={openingTime} closingTime={closingTime} setScheduleModalOpen={setScheduleModalOpen} setSelectedSchedule={setSelectedSchedule}/>
            </div>
          </div>
          <ScheduleModal isOpen={scheduleModalOpen} onClose={() => setScheduleModalOpen(false)} schedule={selectedSchedule} />
        </div>
      );
  }

  if(!professional){
    return (
      <div className="schedule-professional-container">
        <div className="upper-container">
          <NavZone title="Seleccionar Profesional en los filtros"/>
          <GridFilter setProfessional={setProfessional} professionals={professionalsList}/>
        </div>
      </div>
    );
  } else {
      return (
        <div className="schedule-professional-container">
          <div className="schedule-subcontainer">
            <div className="upper-container">
                <NavZone title={`Horarios de ${professional.name}, ${professional.surname}`}/>
                <GridFilter setProfessional={setProfessional} professionals={professionalsList}/>
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

