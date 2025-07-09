import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faBars} from '@fortawesome/free-solid-svg-icons'
import {Link} from 'react-router-dom';
import {Session} from './Session';
import '../styles/Header.css';

export function Header(){
    return(
        <div className="header-container">   
            <div className="header-left">  
                <button><FontAwesomeIcon icon={faBars} /></button>
                <div >
                    <Link className="title" to={"/"}>
                        Consultorios de Jardin
                    </Link>
                </div>
            </div>
            <div className="header-right">
                <Session/>
            </div>
        </div>
        
    );
}