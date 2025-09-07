import "./scheduleProfessional.css";
import {NavZone} from "../../components/navZone/NavZone";
import type{ Person, Schedule } from "../types.ts"
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

const schedules: Schedule[] = [ //carga manual de horarios 
  {
    day: "lunes",
    initialHour: "08:00",
    finalHour: "10:00",
    Person: "maria.lopez@example.com",
    Room: "1",
    state: true,
    allowedType: "simple",
  },
  {
    day: "lunes",
    initialHour: "10:30",
    finalHour: "12:00",
    Person: "juan.perez@example.com",
    Room: "2",
    state: false,
    allowedType: "simple",
  },
  {
    day: "martes",
    initialHour: "09:00",
    finalHour: "11:00",
    Person: "sofia.gomez@example.com",
    Room: "3",
    state: true,
    allowedType: "simple",
  },
  {
    day: "miercoles",
    initialHour: "13:00",
    finalHour: "15:00",
    Person: "carlos.ramos@example.com",
    Room: "4",
    state: false,
    allowedType: "simple",
  },
  {
    day: "jueves",
    initialHour: "14:00",
    finalHour: "16:00",
    Person: "ana.torres@example.com",
    Room: "5",
    state: true,
    allowedType: "taller",
  },
  {
    day: "viernes",
    initialHour: "09:00",
    finalHour: "11:30",
    Person: "diego.martinez@example.com",
    Room: "1",
    state: false,
    allowedType: "simple",
  },
  {
    day: "viernes",
    initialHour: "12:00",
    finalHour: "14:00",
    Person: "laura.fernandez@example.com",
    Room: "2",
    state: true,
    allowedType: "simple",
  },
  {
    day: "sabado",
    initialHour: "08:00",
    finalHour: "15:00",
    Person: "laura.fernandez@example.com",
    Room: "2",
    state: true,
    allowedType: "taller",
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

function diffHours(open: string, close: string): number { // PODRIA EN EL SERVICIO
  const [h1, m1] = open.split(":").map(Number);
  const [h2, m2] = close.split(":").map(Number);

  const date1 = new Date(0, 0, 0, h1, m1);
  const date2 = new Date(0, 0, 0, h2, m2);

  const diffMs = date2.getTime() - date1.getTime();
  return diffMs / (1000 * 60 * 60); // diferencia en horas
}
const openedHours = diffHours("10:00","18:00") //  aca irian los openingtime and closingtime del office

function betweenHours(initialHour: string, finalHour: string, hourToCheck: string): boolean { // PODRIA EN EL SERVICIO
  const [h1, m1] = initialHour.split(":").map(Number);
  const [h2, m2] = finalHour.split(":").map(Number);
  const [h3, m3] = hourToCheck.split(":").map(Number);

  const initial = new Date(0, 0, 0, h1, m1);
  const final = new Date(0, 0, 0, h2, m2);
  const toCheck = new Date(0, 0, 0, h3, m3);

  return toCheck >= initial && toCheck <= final;
}

export function ScheduleProfessional(){


  return (
    <div className="schedule-professional-container">
      <div className="upper-container">
          <NavZone title="Horarios de nombre profesional"/>
          <div className="filter-selector">Filtros</div> {/*agregar flechita hacia abajo para indicar abertura*/}
      </div>
      <div className="schedule-container">

        <div className="schedule">
          {daysSpanish.map((day, idx) => (
            <div className="day-column" key={idx}>
              <div className="day-title">
                {day.charAt(0).toUpperCase() + day.slice(1)}
              </div>

              {Array.from({ length: openedHours }).map((_, hourIdx) => {
                const startHour = 8; // ACA IRIA el openingTime del office
                const currentHour = startHour + hourIdx;
                const currentHourStr = String(currentHour).padStart(2, "0") + ":00";

                // Busco si hay un schedule para este día y esta hora
                const schedule = schedules.find(
                  (s) =>
                    s.day.toLowerCase() === day.toLowerCase() &&
                    betweenHours(s.initialHour, s.finalHour, currentHourStr)
                );

                return (
                  <div
                    key={hourIdx}
                    className={`hourly-module ${
                      schedule ? schedule.allowedType : "empty"
                    }`}
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
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

