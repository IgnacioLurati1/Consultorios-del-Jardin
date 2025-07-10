import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import "../styles/LateralMenu.css"; 
import Logo from '../assets/Logo.png';
import "../styles/Header.css";

type LateralMenuItem = {
  faviconName: string;
  title: string;
  path: string;
};

type LateralMenuProps = {
  isOpen: boolean;
  items: LateralMenuItem[];
  onClose: () => void;
};

import {
  faHouse,
  faUser,
  faCalendarDays,
  faCreditCard,
  faPhone,
  faArrowLeft,
} from '@fortawesome/free-solid-svg-icons';

const iconMap: Record<string, IconDefinition> = {
  home: faHouse,
  user: faUser,
  calendar: faCalendarDays,
  creditCard: faCreditCard,
  phone: faPhone,
};

export function LateralMenu({isOpen, items, onClose }: LateralMenuProps) {
  return (
    <div className={`lateral-menu ${isOpen ? 'open' : 'closed'}`}>
        <div>
            {items.map((item) => {
                const icon = iconMap[item.faviconName] ?? faHouse; // ícono por defecto
                return (
                <Link className='link-menu-item' onClick={onClose} key={item.path} to={item.path}>
                    <div className="menu-item">
                    <FontAwesomeIcon icon={icon} />
                    <span>{item.title}</span>
                    </div>
                </Link>
                );
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
