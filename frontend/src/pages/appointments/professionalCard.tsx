import type{Person} from "../types.ts"
import { FaUserTie, FaPhone } from "react-icons/fa";
import './professionalCard.css';

interface ProfessionalCardProps {
    professional: Person;
    }
export function ProfessionalCard({ professional }:ProfessionalCardProps){
    return (
        <>
            <div className="professional-card">
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

                <button className="action-button">Sacar turno</button>
            </div>
        </>
    );
};