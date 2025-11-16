import type{Person,Office} from "../../types.ts"
import { FaUserTie, FaPhone } from "react-icons/fa";
import './professionalCard.css';
import { useNavigate } from 'react-router-dom';

interface ProfessionalCardProps {
    professional: Person;
    office: Office|undefined;
    display: boolean;
    }
export function ProfessionalCard({ professional, office,display }:ProfessionalCardProps){
    const navigate = useNavigate();

    function handleAppointment(){
        navigate("/AppointmentDetails", {
            state: { office, professional },
            replace: true,
        });
    }
    return (
        <>
            <div className={display? "professional-box":"professional-box hidden"}>
                <div className="professional-info">
                    <div className="professional-avatar">
                        <FaUserTie className="avatar-icon" />
                    </div>
                
                    <div className="professional-details">
                        <div className="professional-name">
                            {professional.name + ", " + professional.surname}
                            <FaPhone className="phone-icon" />
                        </div>

                        <div className="professional-specialty">{professional.speciality}</div>
                    </div>
                </div>

                <button className="action-button" onClick={handleAppointment}>Sacar turno</button>
            </div>
        </>
    );
};