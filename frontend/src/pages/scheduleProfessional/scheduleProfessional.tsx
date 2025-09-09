import "./scheduleProfessional.css";
import {NavZone} from "../../components/navZone/NavZone";
import { GridModule } from "./gridSchedule/gridModule.tsx";
import type{ Person, Schedule, Duration } from "../types.ts"
/*import {jwtDecode} from "jwt-decode";
import {useNavigate} from "react-router-dom"
import { useEffect, useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import { findOne } from "../professionalCRUD/ProfessionalService.ts" FALTA SERVICIOS DE PROFESIONALES


interface TokenPayload {
    email:string;
    type:string;
    exp:number;
}

const [professional, setProfessional] = useState<People>([]);
const [schedules, setSchedules] = useState<Schedule>([]);

const navigate  = useNavigate()

const token = localStorage.getItem("token")
if(token){
  const decoded: TokenPayload = jwtDecode(token);
}else{
  console.log("Invalid token retrieved")
  navigate('/');
}

useEffect(() => {
        findOne(decoded.mail)
        .then(data => {
            setProfessional(data);})
        .catch(err => {
            toast.error("Error cargando el profesional:" + err)});
    }, []);
//------------------------------------------------------------FETCH DE PROFESIONAL X MAIL  ----------------- 


useEffect(() => {
        findAllActiveSchedules()
        .then(data => {
            setSchedules(data);})
        .catch(err => {
            toast.error("Error cargando horarios:" + err)});
    }, []);
//------------------------------------------------------------FETCH DE LOS HORARIOS  ----------------- 
*/

const durations: Duration[] = [
  { idDuration: "1", duration: "15" },
  { idDuration: "2", duration: "30" },
  { idDuration: "3", duration: "45" },
  { idDuration: "4", duration: "60" },
];

const schedules: Schedule[] = [
  {
    day: "lunes",
    initialHour: "08:00",
    finalHour: "10:00",
    Person: "maria.lopez@example.com",
    Room: "1",
    active: true,
    allowedType: "simple",
    durations: [durations[3]], // 60
  },
  {
    day: "lunes",
    initialHour: "11:00",
    finalHour: "16:00",
    Person: "maria.lopez@example.com",
    Room: "1",
    active: true,
    allowedType: "simple",
    durations: [durations[3]], // 60
  },
  {
    day: "martes",
    initialHour: "10:00",
    finalHour: "11:00",
    Person: "juan.perez@example.com",
    Room: "2",
    active: false,
    allowedType: "simple",
    durations: [], // sin duration
  },
  {
    day: "miercoles",
    initialHour: "11:00",
    finalHour: "15:00",
    Person: "sofia.gomez@example.com",
    Room: "3",
    active: true,
    allowedType: "taller", // único taller
    durations: [durations[0], durations[1]], // 15 y 30
  },
  {
    day: "jueves",
    initialHour: "09:00",
    finalHour: "10:00",
    Person: "carlos.ramos@example.com",
    Room: "4",
    active: false,
    allowedType: "simple",
    durations: [durations[2]], // 45
  },
  {
    day: "viernes",
    initialHour: "11:00",
    finalHour: "14:00",
    Person: "laura.fernandez@example.com",
    Room: "5",
    active: true,
    allowedType: "simple",
    durations: [durations[1]],
  },
  {
    day: "sabado",
    initialHour: "10:00",
    finalHour: "16:00",
    Person: "laura.fernandez@example.com",
    Room: "5",
    active: true,
    allowedType: "taller",
    durations: [durations[1]],
  },
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
const closingTime = "16:00"

export function ScheduleProfessional(){

  return (
    <div className="schedule-professional-container">
      <div className="upper-container">
          <NavZone title="Horarios de nombre profesional"/>
          <div className="filter-selector">Filtros</div> {/*agregar flechita hacia abajo para indicar abertura*/}
      </div>
      <div className="schedule-container">
        <GridModule schedules={schedules} daysSpanish={daysSpanish} openingTime={openingTime} closingTime={closingTime}/>
      </div>
    </div>
  );
};

