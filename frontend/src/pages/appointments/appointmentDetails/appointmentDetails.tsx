import { useEffect, useState } from "react";
import type { Office, Person } from "../../types.ts"
import './appointmentDetails.css';
import { FaChevronLeft, FaPhone, FaUserTie } from 'react-icons/fa';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from "react-toastify";
import { findPerson, getDecodedToken } from "../../commonServices.ts";
import { BiColor } from "react-icons/bi";


interface AppointmentDetailsProps {
    office: Office;
    professional: Person;
}

export function AppointmentDetails() {

    const [patient, setPatient] = useState<Person | undefined>(undefined);
    const location = useLocation();
    const state = location.state as AppointmentDetailsProps | null;

    useEffect(() => {
        const decoded = getDecodedToken();
        if (!decoded) return;
        const email = decoded.email
        findPerson(email)
        .then(data => {
            if (!data) {
            toast.error("No se encontró el paciente");
            return;
            }
        setPatient(data);
        })
            .catch(err => toast.error(`Error al cargar el paciente: ${err.message}`));
    }, []);

    if (!state || patient === undefined) {
        return <div>No se proporcionaron detalles del turno.</div>;
    }

    const office = state.office;
    const person = state.professional;

    return (
        <>
            <div className="appointment-details-container">
                <div className="appointment-details-wrapper">
                    <div className="appointment-details-header">
                        <button className="appointment-details-back-btn">
                        <FaChevronLeft size={24} />
                        </button>
                        <h1 className="appointment-details-title">Detalles del turno</h1>
                    </div>

                    <div className="appointment-details-content">
                        <div className="appointment-details-grid">
                            {/* Paciente Section */}
                            <div className="patient-section">
                                <div className="section-header">
                                    <h2 className="section-title">Paciente</h2>
                                    <FaChevronLeft className="section-chevron" size={20} />
                                </div>

                                <div className="info-list">
                                    <div>
                                        <span className="info-label">Nombre</span>
                                        <span className="info-value"> - {patient.name}</span>
                                    </div>
                                    <div>
                                        <span className="info-label">Apellido</span>
                                        <span className="info-value"> - {patient.surname}</span>
                                    </div>
                                    <div>
                                        <span className="info-label">Email</span>
                                        <span className="info-value"> - {patient.email}</span>
                                    </div>
                                    <div>
                                        <span className="info-label">Telefono</span>
                                        <span className="info-value"> - {patient.phoneNumber}</span>
                                    </div>
                                    <div>
                                        <span className="info-label">DNI</span>
                                        <span className="info-value"> - {patient.docNumber}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Profesional Section */}
                            <div className="professional-section">
                                <div className="section-header">
                                <h2 className="section-title">Profesional</h2>
                                <FaChevronLeft className="section-chevron" size={20} />
                                </div>

                                <div className="professional-details-info">
                                    <div className="professional-details-card">
                                        <div className="professional-details-avatar">
                                            <FaUserTie className="avatar-details-icon" />
                                        </div>

                                        <div className="professional-details">
                                            <div className="professional-name-wrapper">
                                                <span className="professional-name">{person.name + ", " +person.surname}</span>
                                                <FaPhone size={16} className="professional-phone" />
                                            </div>
                                            <p className="professional-specialty">{person.speciality}</p>
                                        </div>
                                    </div>

                                    <div className="location-info">
                                        <span className="info-label">Lugar</span>
                                        <span className="info-value"> - {office.description + ", " + office.city.nameCity}</span>
                                    </div>
                                </div>

                            <button className="reserve-btn">Reservar turno</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="appointment-details-table-container">
                <div>Aca va la tabla de turnos</div>
            </div>
        </>
    );
}