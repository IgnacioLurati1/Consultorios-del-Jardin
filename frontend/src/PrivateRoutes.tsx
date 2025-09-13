import {Navigate} from 'react-router-dom';

interface PrivateRouteProps {
    allowedTypes: string[];
    children: React.ReactNode;
}

export function PrivateRoutes({ allowedTypes, children }: PrivateRouteProps) {
    const token = localStorage.getItem("token");
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
