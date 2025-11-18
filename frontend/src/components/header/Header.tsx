import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faBars} from '@fortawesome/free-solid-svg-icons'
import {Link} from 'react-router-dom';
import {Session} from './session/Session';
import './Header.css';
import {useState} from 'react';
import {LateralMenu} from '../defaultLayout/lateralMenu/LateralMenu';
import LogoHojas from '../../assets/LogoHojasRecortado.png';

export function Header(){

    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

        const menuItems = [
    { faviconName: "home", title: "Home", path: "/", userType: "all"},
    { faviconName: "user", title: "Login", path: "/login", userType: "guest"},
    { faviconName: "phone", title: "Contacto", path: "/contacto" , userType: "all"},
    { faviconName: "database", title: "Menú Admin", path: "/adminHome" , userType: "admin"},
    { faviconName: "professional", title: "Menú Profesional", path: "/professionalHome" , userType: "professional"},
    { faviconName: "appointments", title: "Mis turnos", path: "/AppointmentsList" , userType: "client"},
    { faviconName: "appointments", title: "Administrar turnos", path: "/AppointmentsList" , userType: "professional"},
    { faviconName: "requestAppointments", title: "Solicitar turnos", path: "/Appointment" , userType: "client"},
  ];

    return(
        <>
            <div className="header-container">   
                <div className="header-left">  
                    <button onClick={toggleMenu}><FontAwesomeIcon icon={faBars} /></button>
                    <div >
                        <Link className="title" to={"/"}>
                            <p className="header-title-text">Consultorios del Jardin</p>
                            <img src={LogoHojas} alt="Logo" className="logo-header"/>
                        </Link>
                    </div>
                </div>
                <div className="header-right">
                    <Session/>
                </div>
            </div>
            {isMenuOpen && (
                <div className="backdrop" onClick={toggleMenu}></div>
            )}
            <LateralMenu isOpen={isMenuOpen} items={menuItems} onClose={toggleMenu} />
        </>
    );
}