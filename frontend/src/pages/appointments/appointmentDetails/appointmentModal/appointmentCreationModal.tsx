import type { appointmentCreationModalProps } from "../../appointmentTypes.ts"
import "./appointmentCreationModal.css"
import { FaChevronLeft, FaTimes , FaPhone, FaUserTie } from 'react-icons/fa';

export function AppointmentCreationModal({isOpen, onClose, schedule, selectedDate, professional, office}: appointmentCreationModalProps) {

    function handleKeyDown(event: React.KeyboardEvent) {
        if (event.key !== 'Enter') {
            return;
        } 
    }
    let fechaFormateada = "";
    let diaFormateado = "";
    if (selectedDate){
        const day = String(selectedDate.getDate()).padStart(2, "0");       // "12"
        const month = String(selectedDate.getMonth() + 1).padStart(2, "0"); // "11"
        const year = String(selectedDate.getFullYear()).slice(-2);          // "25"

        fechaFormateada = `${day}/${month}/${year}`;
        diaFormateado = (selectedDate.toLocaleDateString("es-ES", { weekday: "long" })).charAt(0).toUpperCase() + (selectedDate.toLocaleDateString("es-ES", { weekday: "long" })).slice(1)
    }
    

    if (!isOpen) return null;
    return (
        <>
            <div className="appointment-modal-overlay" onClick={onClose}>
                <div className="appointment-modal-details-container" onClick={(e) => e.stopPropagation()}  onKeyDown={handleKeyDown}>
                    <div className="appointment-modal-details-wrapper">
                        <div className="appointment-modal-details-header">
                            <button className="appointment-modal-details-close-btn" onClick={onClose}>
                            <FaTimes  size={25} />
                            </button>
                            <h1 className="appointment-modal-details-title">Detalles del turno</h1>
                        </div>

                        <div className="appointment-modal-details-content">

                            {/* Appointment Section */}
                            <div className="appointment-modal-professional-section">
                                <div className="appointment-modal-section-header">
                                    <h2 className="appointment-modal-section-title">Turno</h2>
                                    <FaChevronLeft className="appointment-modal-section-chevron" size={20} />
                                </div>

                                <div className="appointment-modal-professional-details-info">
                                    <div className="appointment-modal-location-info">
                                        <span className="appointment-modal-info-label">Día</span>
                                        <span className="appointment-modal-info-value"> - {diaFormateado} {fechaFormateada}</span>
                                    </div>
                                    <div className="appointment-modal-location-info">
                                        <span className="appointment-modal-info-label">Horario</span>
                                        <span className="appointment-modal-info-value"> - {selectedDate ? selectedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }): "Sin fecha"} horas</span>
                                    </div>
                                    <div className="appointment-modal-location-info">
                                        <span className="appointment-modal-info-label">Duración estimada</span>
                                        <span className="appointment-modal-info-value"> - {schedule?.duration} minutos</span>
                                    </div>
                                </div>
                            </div>

                            {/* Profesional Section */}
                            <div className="appointment-modal-professional-section">
                                <div className="appointment-modal-section-header">
                                    <h2 className="appointment-modal-section-title">Profesional</h2>
                                    <FaChevronLeft className="appointment-modal-section-chevron" size={20} />
                                </div>

                                <div className="appointment-modal-professional-details-info">
                                    <div className="appointment-modal-professional-details-card">
                                        <div className="appointment-modal-professional-details-avatar">
                                            <FaUserTie className="appointment-modal-avatar-details-icon" />
                                        </div>

                                        <div className="appointment-modal-professional-details">
                                            <div className="appointment-modal-professional-name-wrapper">
                                                <span className="appointment-modal-professional-name">{professional.name + ", " +professional.surname}</span>
                                                <FaPhone size={16} className="appointment-modal-professional-phone" />
                                            </div>
                                            <p className="appointment-modal-professional-specialty">{professional.speciality}</p>
                                        </div>
                                    </div>

                                    <div className="appointment-modal-location-info">
                                        <span className="appointment-modal-info-label">Lugar</span>
                                        <span className="appointment-modal-info-value"> - {office.description + ", " + office.city.nameCity}</span>
                                    </div>
                                </div>
                            </div>
                            <button className="appointment-modal-reserve-btn">Solicitar turno</button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}