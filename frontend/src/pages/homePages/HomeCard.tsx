import { Link } from "react-router-dom";
import { FaArrowUp } from "react-icons/fa";
import "./homeCardCss.css";

interface CardMenuProps {
    icon: React.ComponentType<{ size?: number }> | React.ReactNode;
    title: string;
    link: string;
}

export default function HomeCard({ icon: Icon, title, link }: CardMenuProps) {
    return (
        <Link to={link} className="card-link">

            <div className="card-container">

                <div className="card-title">{title}</div>

                <div className="card-icon">
                    {typeof Icon === "function" ? <Icon/> : Icon}
                </div>
                
                <div className="card-arrow">
                    <FaArrowUp size={40} />
                </div>
            </div>
        </Link>
    );
}
