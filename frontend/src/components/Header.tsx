import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faBars} from '@fortawesome/free-solid-svg-icons'
import {Link} from 'react-router-dom';
import {Session} from './Session';
import '../styles/Header.css';
import {useState} from 'react';
import {LateralMenu} from './LateralMenu';
import LogoHojas from '../assets/LogoHojasRecortado.png';

export function Header(){

    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

        const menuItems = [
    { faviconName: "home", title: "Home", path: "/" },
    { faviconName: "user", title: "Login", path: "/login" },
    { faviconName: "phone", title: "Contacto", path: "/contacto" },
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