import "./appointmentList.css";
import {NavZone} from "../../../components/navZone/NavZone";
import type{ Appointment, Office, Person} from "../../types.ts"
import { useEffect, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import { findPerson, getDecodedToken } from "../../commonServices.ts";
import { findAllActiveOffices } from "../../adminCRUDS/adminOffices/OfficeService.ts";
import {findProfessionalAppointments, findPatientAppointments} from "../appointmentsService.ts"
import { AppointmentsGrid } from "./appointmentsGrid.tsx";
import { AppointmentsGridFilter } from "./appointmentsGridFilter.tsx";
import { DiagnosticModal } from "./diagnosticModal.tsx";


export function AppointmentsList(){

  const [person, setPerson] = useState<Person | undefined>(undefined);
  const [userType, setUserType] = useState("")  //Para diferenciar en componentes si el usuario es admin, professional o client
  const [offices, setOffices] = useState<Office[] | []>([]);
  const [officeToFilter, setOfficeToFilter] = useState<Office|undefined>(undefined);
  const [appointments, setAppointments] = useState<Appointment[] | []>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[] | []>([]);
  const [diagnosticModalOpen, setDiagnosticModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | undefined>(undefined);



  useEffect(() => {

    const decoded = getDecodedToken();
    if (!decoded) return;
        if(decoded.type === "professional"){
        setUserType("professional")}
        else{
            setUserType("client")}
        const email = decoded.email
        findPerson(email)               
        .then(data => {
        if (!data) {
        toast.error("No se encontró a la persona");
        return;
        }
        setPerson(data);
      })
      .catch(err => toast.error(`Error al cargar al profesional: ${err.message}`));
    }, []);

  useEffect(() => {
    if(person && userType === "professional"){
      findProfessionalAppointments()
      .then(data => {
          setAppointments(data);
          setFilteredAppointments(data)
      })
      .catch(err => {
          toast.error(`Error al obtener turnos del profesional: ${err.message}`);
      });
    }else if(person && userType === "client"){
      findPatientAppointments()
      .then(data => {
          setAppointments(data);
          setFilteredAppointments(data)
      })
      .catch(err => {
          toast.error(`Error al obtener turnos del cliente: ${err.message}`);
      });
    }
  }, [person]);
  
  useEffect(() => {
      findAllActiveOffices()
      .then(data => {
          setOffices(data);
      })
      .catch(err => {
          toast.error("Error cargando salas:", err);
      });
  }, []);

  useEffect(() =>{
     if(officeToFilter){
      const filtered = appointments.filter(app => String(app.room.office) === String(officeToFilter.idOffice));
      setFilteredAppointments(filtered);
    } else {
      setFilteredAppointments(appointments);
    }
  },[officeToFilter, appointments])
 
  if(person){
    return (
        <div className="appointment-person-container">
          <div className="appointment-subcontainer">
            <div className="upper-container">
                <NavZone title={`Turnos de ${person.name}, ${person.surname}`}/>
                <ToastContainer className = {`toast-container`} draggable={false}/>
                <AppointmentsGridFilter appointments={appointments} offices={offices} setOfficeToFilter={setOfficeToFilter}/>
            </div>
            <div className="appointment-container">
              <AppointmentsGrid appointments={filteredAppointments} personType={person.type}/>
            </div>
          </div>
          <DiagnosticModal isOpen={diagnosticModalOpen} onClose={() => setDiagnosticModalOpen(false)} appointment={selectedAppointment} />
        </div>
      );
  } else if(!person){
    return (
      <div className="appointment-person-container">
        <div className="appointment-subcontainer">
          <div className="upper-container">
            <NavZone title="Seleccionar Persona en los filtros"/>
            <ToastContainer className = {`toast-container`} draggable={false}/>
            <AppointmentsGridFilter appointments={appointments} offices={offices} setOfficeToFilter={setOfficeToFilter}/>
          </div>
        </div>
      </div>
    );
  } 
}

