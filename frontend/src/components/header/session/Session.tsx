import {LoginRegister} from "./LoginRegister";
import {Profile} from "./Profile";
import '../Header.css';
import { useAuth } from "../../../context/AuthContext";

export function Session() {
    const {token} = useAuth();

    return (
        <div className="session">
            {
            token ? 
            <Profile/> :
            <></>
            }
            <LoginRegister/>
            
        </div>
    );
}

