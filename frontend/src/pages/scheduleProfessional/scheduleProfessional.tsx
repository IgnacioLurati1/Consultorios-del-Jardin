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
import { findPerson, getDecodedToken } from "../commonServices.ts";

const openingTime = "08:00"
const closingTime = "21:00"

export function ScheduleProfessional(){

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | undefined>(undefined);
  const [selectedKey, setSelectedKey] = useState<string | undefined>();
  const [professionalsList, setProfessionalsList] = useState<Person[] | []>([]);
  const [professional, setProfessional] = useState<Person | undefined>(undefined);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [filteredSchedules, setFilteredSchedules] = useState<Schedule[]>([]);
  const [isProfessional, setIsProfessional] = useState(false)  //Para diferenciar en componentes si el usuario es admin o professional
  const [rooms, setRooms] = useState<Room[] | []>([]);
  const [offices, setOffices] = useState<Office[] | []>([]);
  const [cities, setCities] = useState<City[] | []>([]);
  const [officeToFilter, setOfficeToFilter] = useState<Office|undefined>(undefined);
  const [roomToFilter, setRoomToFilter] = useState<Room|undefined>(undefined)

  useEffect(() => {

    const decoded = getDecodedToken();
    if (!decoded) return;
    if(decoded.type === "professional"){
      setIsProfessional(true) 
      const email = decoded.email
      findPerson(email)               //Si el ususario logeado es un profesional, obtengo sus datos y no cargo toda la lista de profesionales
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
          setFilteredSchedules(data)
      })
      .catch(err => {
          toast.error(`Error al obtener horarios del profesional: ${err.message}`);
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

  useEffect(() =>{
     if(officeToFilter){
      const filtered = schedules.filter(sch => String(sch.room.office) === String(officeToFilter.idOffice));
      setFilteredSchedules(filtered);
    } else {
      setFilteredSchedules(schedules);
    }
  },[officeToFilter, schedules])


  useEffect(()=>{ //Filtro por sala cuando se setea en el filter
    if(roomToFilter){
      const filtered = schedules.filter(sch => sch.room.idRoom === roomToFilter.idRoom);
      setFilteredSchedules(filtered);
    } else {
      setFilteredSchedules(schedules);
    }
  },[roomToFilter, schedules])



  async function addSchedule(newSchedule: { day: string, initialHour: string, finalHour: string, room: string, personEmail: string, allowedType: string, duration: number }){     
    try{
      const createdSchedule = await createSchedule(newSchedule)
      if (createdSchedule ){
          setSchedules([createdSchedule, ...schedules]);
          toast.success(`Horario creado con éxito`);
          setScheduleModalOpen(false);
        }
    }catch (error:any){
      toast.error(`Error al crear el horario: ${error.message}`);
    }
  }
  async function deleteSchedule(professionalEmail: string, day: string, initialHour:string) {
    try{  
    if (await removeSchedule(professionalEmail, day, initialHour)){
          setSchedules(prev =>
                        prev.filter(s => !(s.person.email === professionalEmail && s.day === day && s.initialHour === initialHour))
                      );
          toast.success(`Horario eliminado con éxito`);
          setScheduleModalOpen(false);
      }
    }catch (error:any){
      toast.error(`Error al eliminar el horario: ${error.message}`);
    }
  }
 
  if(professional && isProfessional){
    return (
        <div className="schedule-professional-container">
          <div className="schedule-subcontainer">
            <div className="upper-container">
                <NavZone title={`Horarios de ${professional.name}, ${professional.surname}`}/>
                <ToastContainer className = {`toast-container`} draggable={false}/>
                <GridFilter setProfessional={setProfessional} schedules={schedules} offices={offices} setOfficeToFilter={setOfficeToFilter} setRoomToFilter={setRoomToFilter}/>
            </div>
            <div className="schedule-container">
              <GridModule schedules={schedules} daysSpanish={daysSpanish} openingTime={openingTime} closingTime={closingTime} setScheduleModalOpen={setScheduleModalOpen} setSelectedSchedule={setSelectedSchedule} setSelectedKey={setSelectedKey}/>
            </div>
          </div>
          <ScheduleModal isOpen={scheduleModalOpen} onClose={() => setScheduleModalOpen(false)} schedule={selectedSchedule} cellKey={selectedKey} daysSpanish={daysSpanish} professional={professional} rooms={rooms} offices={offices} cities={cities} onCreate={addSchedule} onDelete={deleteSchedule}/>
        </div>
      );
  } else if(!professional){
    return (
      <div className="schedule-professional-container">
        <div className="schedule-subcontainer">
          <div className="upper-container">
            <NavZone title="Seleccionar Profesional en los filtros"/>
            <ToastContainer className = {`toast-container`} draggable={false}/>
            <GridFilter setProfessional={setProfessional} professionals={professionalsList} setOfficeToFilter={setOfficeToFilter} setRoomToFilter={setRoomToFilter}/>
          </div>
        </div>
      </div>
    );
  } else {
      return (
        <div className="schedule-professional-container">
          <div className="schedule-subcontainer">
            <div className="upper-container">
                <NavZone title={`Horarios de ${professional.name}, ${professional.surname}`}/>
                <ToastContainer className = {`toast-container`} draggable={false}/>
                <GridFilter setProfessional={setProfessional} professionals={professionalsList} schedules={schedules} offices={offices} setOfficeToFilter={setOfficeToFilter} setRoomToFilter={setRoomToFilter}/>
            </div>
            <div className="schedule-container">
              <GridModule schedules={filteredSchedules} daysSpanish={daysSpanish} openingTime={openingTime} closingTime={closingTime} setScheduleModalOpen={setScheduleModalOpen} setSelectedSchedule={setSelectedSchedule} setSelectedKey={setSelectedKey}/>
            </div>
          </div>
          <ScheduleModal isOpen={scheduleModalOpen} onClose={() => setScheduleModalOpen(false)} schedule={selectedSchedule} cellKey={selectedKey} daysSpanish={daysSpanish} professional={professional} rooms={rooms} offices={offices} cities={cities} onCreate={addSchedule} onDelete={deleteSchedule}/>
        </div>
      );
  }
}

