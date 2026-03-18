import { type Diagnostic, type Appointment, type Person, type Office } from "../../../types.ts";
import { FaUserDoctor, FaLocationDot, FaXmark, FaClipboard, FaClock } from "react-icons/fa6";
import "./appointmentCell.css";
import { findPerson } from "../../../commonServices.ts";
import { toast } from "react-toastify"; // Asumo que importas de 'react-toastify' no 'unstyled'
import { useEffect, useState } from "react";
import { acceptAppointment, cancelAppointmentService, GetAppointmentDiagnostics } from "../../appointmentsService.ts";
import { ConfirmCancel } from "./confirmCancel.tsx";
import { AppointmentDiagnostic } from "./appointmentDiagnostic/appointmentDiagnostic.tsx";
import { FaCheck } from "react-icons/fa";

// --- INTERFAZ DE PROPS ACTUALIZADA ---
interface AppointmentCellProps {
  appointment: Appointment;
  user: Person;
  // --- Callbacks del padre ---
  onDiagnosticsUpdate: (idAppointment: number, updatedDiagnostics: Diagnostic[]) => void;
  onAppointmentStateUpdate: (idAppointment: number, newState: string) => void;

}

export function AppointmentCell({
  appointment,
  user,
  onDiagnosticsUpdate,
  onAppointmentStateUpdate
}: AppointmentCellProps) {

  const dateObj = new Date(appointment.date);
  const nombreMes = new Intl.DateTimeFormat('es-ES', { month: 'short', timeZone: 'UTC' }).format(dateObj).toUpperCase();
  const [personName, setPersonName] = useState("");
  const [isCanceled, setIsCanceled] = useState(false);
  
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>(appointment.diagnostics || []);
  
  const [showCancel, setShowCancel] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  
  const [state, setState] = useState(appointment.state);

  const[estado, setEstado]= useState(false);
  

  // Sincronizamos el estado interno si los props cambian
  useEffect(() => {
    setDiagnostics(appointment.diagnostics || []);
  }, [appointment.diagnostics]);

  useEffect(() => {
    setState(appointment.state);
  }, [appointment.state]);


  useEffect(() => {
    if (user.type === "professional" && appointment.type === "simple" && diagnostics.length > 0) {
      let person = diagnostics[0].patient;
      findPerson(person)
        .then(data => {
          if (data) {
            setPersonName(`${data.name} ${data.surname}`);
          } else {
            setPersonName("No encontrado");
          }
        })
        .catch(err => {
          toast.error(`Error al cargar a la persona: ${err.message}`);
          setPersonName("Error");
        });
    }
    else if (user.type === "professional" && appointment.type === "taller") {
      setPersonName("Varios pacientes");
    }
    else {
      findPerson(appointment.professional.email)
        .then(data => {
          if (data) {
            setPersonName(`${data.name} ${data.surname}`);
          } else {
            setPersonName("No encontrado");
          }
        })
        .catch(err => {
          toast.error(`Error al cargar a la persona: ${err.message}`);
          setPersonName("Error");
        });
    }
  }, [diagnostics, user.type, appointment.type, appointment.professional]);

  useEffect(() => {
    if (appointment.state != "pending" && appointment.state != "accepted" && !isCanceled) {
      setIsCanceled(true);
    }
    if (user.type === "client" && appointment.type === "taller" && diagnostics.length > 0) {
      let patientDiagnostic = diagnostics.find(d => d.patient === user.email);
      if (patientDiagnostic?.state === "canceled" && !isCanceled) {
        setIsCanceled(true);
      }
    }
  }, [appointment, diagnostics, user.type, user.email, isCanceled]); 

  function cancelAppointment(numAppointment: number) {
    cancelAppointmentService(numAppointment)
      .then((success: boolean) => {
        if (success) {
          setIsCanceled(true);
          toast.success("Cita cancelada");
          onAppointmentStateUpdate(numAppointment, "canceled"); 
        } else {
          toast.error("Error al cancelar la cita");
        }
      });
  }

  function handleAcceptAppointment(numAppointment: number) {
    acceptAppointment(numAppointment)
      .then((success: boolean) => {
        if (success) {
          setState("accepted");
          toast.success("Cita aceptada");
          onAppointmentStateUpdate(numAppointment, "accepted");
        } else {
          toast.error("Error al aceptar la cita");
        }
      })
      .catch(err => {
        toast.error(`Error al aceptar la cita: ${err.message}`);
      });
  }

  function handleDiagnosticUpdate() {
    if(appointment.state !== "accepted"){
      acceptAppointment(appointment.numAppointment)
      .then((success: boolean) => {
        if (success) {
          setState("accepted");
          onAppointmentStateUpdate(appointment.numAppointment, "accepted");
        } else {
          toast.error("Error al aceptar la cita");
        }
      })
      .catch(err => {
        toast.error(`Error al aceptar la cita: ${err.message}`);
      });
    }
    GetAppointmentDiagnostics(appointment.numAppointment)
      .then(data => {
        setDiagnostics(data);
        onDiagnosticsUpdate(appointment.numAppointment, data);
      })
      .catch(err => {
        toast.error(`Error al cargar los diagnósticos: ${err.message}`);
      });
  }

  return (
    <div className="appointment-cell">
      <div className="appointment-cell-data">
        <div className="appointment-cell-datetime">
            <div>{dateObj.getUTCFullYear()}</div>
            <div className={`appointment-cell-month-day ${appointment.type === "simple" ? "simple-appointment" : "taller-appointment"}`}>
                <div>{dateObj.getUTCDate()}</div>
                <div>{nombreMes}</div>
            </div>
            <div>{appointment.initialHour.substring(0, 5)} - {appointment.finalHour.substring(0, 5)}</div>
        </div>
        <div className="appointment-cell-details">
            <div><FaUserDoctor/> {personName}</div>
            <div><FaLocationDot/>{appointment.room.office.description} {appointment.room.description}</div>
        </div>
      </div>
      <div className="appointment-cell-buttons">

        {!isCanceled ? (
          <>
          <button className="appointment-cell-button diagnostic-button" onClick={() => setShowDiagnostic(true)}><FaClipboard /> Diagnóstico</button>
          {user.type === "professional" ? (<>{state === "pending" ? (
              <button className="appointment-cell-button pending-button" onClick={() => handleAcceptAppointment(appointment.numAppointment)}>
                <FaClock /><span className="default-text">Pendiente</span><span className="hover-text">Aceptar</span>
              </button>
            ) : diagnostics.some(d => d.state === "assisted") ? (
              <button className="appointment-cell-button attended-button"><FaCheck /> Atendido</button>
            ) : (
              <button className="appointment-cell-button mark-button"><FaClock /> No atendido</button>
            )}</>):<>
              {appointment.state === "accepted" ? <>
                <div className="appointment-cell-info accepted-client"><FaCheck />Aceptado</div>
              </>: <><div className="appointment-cell-info pending-client"><FaClock />Pendiente</div></>}
            </> }
            {diagnostics.every(d => d.state !== "assisted") ? 
            <button className="appointment-cell-button cancel-button" onClick={() => setShowCancel(true)}><FaXmark />Cancelar</button>: <></>}
          </>):<><button className="appointment-cell-info canceled-button" disabled>Cancelado</button></>}

      </div>
      <div className="appointment-cell-confirm-cancel">
        {showCancel && (
          <ConfirmCancel
            setShowCancel={setShowCancel}
            numAppointment={appointment.numAppointment}
            cancelAppointment={cancelAppointment}
          />
        )}
        {showDiagnostic && (
          <AppointmentDiagnostic
            type={user.type}
            appointment={appointment}
            diagnostics={diagnostics}
            user={user}
            setShowDiagnostic={setShowDiagnostic}
            onDiagnosticUpdate={handleDiagnosticUpdate} // Esto llama a la función de la celda
          />
        )}
      </div>
    </div>
  );
}