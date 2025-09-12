import { Link } from "react-router-dom";
import {FaUser} from "react-icons/fa";
export function Profile() {
    return (
        <Link to={"/EditProfile"} className="profile-icon button-right">
            <FaUser />
        </Link>
     );
}