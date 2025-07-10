import '../styles/NotFoundPage.css';
import { Link } from 'react-router-dom';
import Logo from '../assets/Logo.png';

// This component represents a 404 Not Found page in a React application.
export function NotFoundPage() {

    return (
        <div className="not-found-container">
            <img src={Logo} alt="Logo consultorios del jardin" className="not-found-image" />
            <h1 className="not-found-title">404 - Página no encontrada</h1>
            <p className="not-found-message">Lo sentimos, la página que buscas no existe.</p>
            <Link to="/" className="not-found-button">
                    Volver al inicio
            </Link>
        </div>
    );

}