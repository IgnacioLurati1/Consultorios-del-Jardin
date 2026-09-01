import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FaXmark } from "react-icons/fa6";
import Logo from "../../../assets/Logo.png";
import {
  faHouse,
  faUser,
  faCalendarDays,
  faCreditCard,
  faPhone,
  faUserTie,
  faDatabase,
  faCalendarCheck,
} from "@fortawesome/free-solid-svg-icons";
import { getDecodedToken } from "../../../pages/commonServices";
import "./LateralMenu.css";

type LateralMenuItem = {
  faviconName: string;
  title: string;
  path: string;
  userType: string; // 'admin','professional','client','guest','all'
};

type LateralMenuProps = {
  isOpen: boolean;
  items: LateralMenuItem[];
  onClose: () => void;
};

const iconMap: Record<string, IconDefinition> = {
  home: faHouse,
  user: faUser,
  calendar: faCalendarDays,
  creditCard: faCreditCard,
  phone: faPhone,
  database: faDatabase,
  professional: faUserTie,
  appointments: faCalendarCheck,
  requestAppointments: faCalendarDays,
};

export function LateralMenu({ isOpen, items, onClose }: LateralMenuProps) {
  const decodedToken = isOpen ? getDecodedToken() : null;
  const currentUserType = decodedToken ? decodedToken.type : "guest";

  const visible = items.filter((item) => item.userType === "all" || item.userType === currentUserType);

  return (
    <nav className={`lateral-menu ${isOpen ? "open" : "closed"}`} aria-hidden={!isOpen}>
      <div className="lateral-menu-head">
        <img src={Logo} alt="Consultorios del Jardín" className="lateral-menu-logo" />
        <button type="button" className="lateral-menu-close" onClick={onClose} aria-label="Cerrar menú">
          <FaXmark />
        </button>
      </div>

      <div className="lateral-menu-items">
        {visible.map((item) => (
          <Link className="lateral-menu-item" onClick={onClose} key={`${item.userType}-${item.path}`} to={item.path}>
            <span className="lateral-menu-icon">
              <FontAwesomeIcon icon={iconMap[item.faviconName] ?? faHouse} />
            </span>
            {item.title}
          </Link>
        ))}
      </div>

      <p className="lateral-menu-foot">Consultorios del Jardín</p>
    </nav>
  );
}
