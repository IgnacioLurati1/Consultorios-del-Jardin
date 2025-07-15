import { Link } from "react-router-dom";
import "../styles/AdminCard.css";

export function AdminCard({ title, description, imageUrl, link }: { title: string; description: string; imageUrl: string; link: string }) {
    return (
        <Link to={link} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="admin-card">
                <img className="img" src={imageUrl} alt={title} />
                <h2>{title}</h2>
                <p>{description}</p>
            </div>
        </Link>
    );
}
