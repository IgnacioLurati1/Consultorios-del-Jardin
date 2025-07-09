import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import "../styles/LateralMenu.css"; 
import Logo from '../assets/Logo.png';

type LateralMenuItem = {
  faviconName: string;
  title: string;
  path: string;
};

type LateralMenuProps = {
  isOpen: boolean;
  items: LateralMenuItem[];
};

import {
  faHouse,
  faUser,
  faCalendarDays,
  faCreditCard,
  faPhone,
} from '@fortawesome/free-solid-svg-icons';

const iconMap: Record<string, IconDefinition> = {
  home: faHouse,
  user: faUser,
  calendar: faCalendarDays,
  creditCard: faCreditCard,
  phone: faPhone,
};

export function LateralMenu({isOpen, items }: LateralMenuProps) {
  return (
    <div className={`lateral-menu ${isOpen ? 'open' : 'closed'}`}>
        <div>
            {items.map((item) => {
                const icon = iconMap[item.faviconName] ?? faHouse; // ícono por defecto
                return (
                <Link className='link-menu-item' key={item.path} to={item.path}>
                    <div className="menu-item">
                    <FontAwesomeIcon icon={icon} />
                    <span>{item.title}</span>
                    </div>
                </Link>
                );
            })}
        </div>
        <div className="logo-container">
            <img src={Logo} alt="Logo" className="logo" />
        </div>
    </div>
  );
}
