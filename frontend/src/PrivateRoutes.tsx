import {Navigate} from 'react-router-dom';
import { useAuth } from './context/AuthContext';

interface PrivateRouteProps {
    allowedTypes: string[];
    children: React.ReactNode;
}

export function PrivateRoutes({ allowedTypes, children }: PrivateRouteProps) {
    // El token sale del contexto y no de localStorage: cuando la sesión se recupera al
    // abrir la aplicación, esto tiene que volver a dibujarse con el token nuevo.
    const { token, restoring } = useAuth();

    // Todavía se está averiguando si hay sesión. Mandar al login ahora sería echar a
    // alguien que en un instante va a estar adentro.
    if (restoring) return null;
    let userType : string | null = null;

    if (token) {
        try{
            const payload = JSON.parse(atob(token.split('.')[1])) as { type: string };
            userType = payload.type;
        } catch (error) {
            console.error("Error parsing token:", error);
            userType = null;
        }
    }

    if (!userType || !allowedTypes.includes(userType)) {
        return <Navigate to="/login" />;
    }

    return <>{children}</>;
}
