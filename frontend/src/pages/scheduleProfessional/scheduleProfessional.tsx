import "./scheduleProfessional.css";
import {NavZone} from "../../components/navZone/NavZone";
import { GridModule } from "./gridSchedule/gridModule.tsx";
import type{ Person, Schedule, Room, Office, City} from "../types.ts"
import { GridFilter } from "./gridFilter/gridFilter.tsx";
import { useEffect, useState } from "react";
import { ScheduleModal } from "./scheduceModal/scheduleModal.tsx";
import {findAllProfessionals, findProfessionalSchedules} from "./scheduleServices.ts"
import { ToastContainer, toast } from "react-toastify";
import { findAllActiveRooms } from "../adminCRUDS/adminRooms/RoomService.ts";
import { findAllActiveCities } from "../adminCRUDS/adminCities/CityService.ts";
import { findAllActiveOffices } from "../adminCRUDS/adminOffices/OfficeService.ts";
import { createSchedule, removeSchedule } from "./scheduleServices.ts";
import { daysSpanish } from "./scheduleTypes.ts";

const openingTime = "08:00"
const closingTime = "21:00"


export function ScheduleProfessional(){

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | undefined>(undefined);
  const [selectedKey, setSelectedKey] = useState<string | undefined>();
  const [professionalsList, setProfessionalsList] = useState<Person[] | []>([]);
  const [professional, setProfesional] = useState<Person | undefined>(undefined);
  const [schedules, setSchedules] = useState<Schedule[] | []>([]);
  const [rooms, setRooms] = useState<Room[] | []>([]);
  const [offices, setOffices] = useState<Office[] | []>([]);
  const [cities, setCities] = useState<City[] | []>([]);

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
          setSchedules(data);
      })
      .catch(err => {
          toast.error("Error cargando horarios:", err);
      });
    }
  }, [professional]);

  useEffect(() => {
      findAllActiveRooms()
      .then(data => {
          setRooms(data);
      })
      .catch(err => {
          toast.error("Error cargando salas:", err);
      });
  }, []);
  
  useEffect(() => {
      findAllActiveOffices()
      .then(data => {
          setOffices(data);
      })
      .catch(err => {
          toast.error("Error cargando salas:", err);
      });
  }, []);

  useEffect(() => {
      findAllActiveCities()
      .then(data => {
          setCities(data);
      })
      .catch(err => {
          toast.error("Error cargando salas:", err);
      });
  }, []);

  async function addSchedule(newSchedule: { day: string, initialHour: string, finalHour: string, room: string, personEmail: string, allowedType: string, duration: number }){
    console.log(newSchedule)      
    const createdSchedule = await createSchedule(newSchedule)
    if(createdSchedule){
        setSchedules([createdSchedule, ...schedules]);
        setScheduleModalOpen(false);
    }
  }
  async function deleteSchedule(professionalEmail: string, day: string, initialHour:string) {
      if (await removeSchedule(professionalEmail, day, initialHour)){
          setSchedules(schedules.filter(schedule => (schedule.person.email !== professionalEmail && schedule.day !== day && schedule.initialHour !== initialHour))); //A CHEQUEAR SI FUNCIONA BIEN
          setScheduleModalOpen(false);
          }
      }
  console.log(schedules)    


  if(!professional){
    return (
      <div className="schedule-professional-container">
        <div className="upper-container">
          <NavZone title="Seleccionar Profesional en los filtros"/>
          <ToastContainer className = {`toast-container`} draggable={false} />
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
                <ToastContainer className = {`toast-container`} draggable={false} />
                <GridFilter setProfessional={setProfesional} professionals={professionalsList}/>
            </div>
            <div className="schedule-container">
              <GridModule schedules={schedules} daysSpanish={daysSpanish} openingTime={openingTime} closingTime={closingTime} setScheduleModalOpen={setScheduleModalOpen} setSelectedSchedule={setSelectedSchedule} setSelectedKey={setSelectedKey}/>
            </div>
          </div>
          <ScheduleModal isOpen={scheduleModalOpen} onClose={() => setScheduleModalOpen(false)} schedule={selectedSchedule} cellKey={selectedKey} daysSpanish={daysSpanish} professional={professional} rooms={rooms} offices={offices} cities={cities} onCreate={addSchedule} onDelete={deleteSchedule}/>

        </div>
      );
  }
}

