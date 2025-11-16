import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import "./LateralMenu.css"; 
import Logo from '../../../assets/Logo.png';
import "../../header/Header.css";
import {
  faHouse,
  faUser,
  faCalendarDays,
  faCreditCard,
  faPhone,
  faUserTie,
  faArrowLeft,
  faDatabase,
  faCalendarCheck,
} from '@fortawesome/free-solid-svg-icons';
import { getDecodedToken } from '../../../pages/commonServices';

type LateralMenuItem = {
  faviconName: string;
  title: string;
  path: string;
  userType: string; // 'admin','professional','client','guest' <--- valores posibles
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

let currentUserType = 'all'; // Valor por defecto

export function LateralMenu({isOpen, items, onClose }: LateralMenuProps) {
  
  if (isOpen){
    const decodedToken = getDecodedToken();
    currentUserType = decodedToken ? decodedToken.type : 'guest';
  }
  
  return (
    <div className={`lateral-menu ${isOpen ? 'open' : 'closed'}`}>
        <div>
            {items.map((item) => {
              if(item.userType == 'all' || item.userType == currentUserType) {
                const icon = iconMap[item.faviconName] ?? faHouse; // ícono por defecto
                return (
                <Link className='link-menu-item' onClick={onClose} key={item.path} to={item.path}>
                    <div className="menu-item">
                    <FontAwesomeIcon icon={icon} />
                    <span>{item.title}</span>
                    </div>
                </Link>
                );
            }
            })}
        </div>
        <div className='back-button' onClick={onClose}>
            <FontAwesomeIcon icon={faArrowLeft} />
        </div>
        <div className="logo-container">
            <img src={Logo} alt="Logo" className="logo" />
        </div>
    </div>
  );
}
