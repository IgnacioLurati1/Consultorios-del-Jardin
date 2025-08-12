import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faGreaterThan} from '@fortawesome/free-solid-svg-icons'
import './NavZone.css';

export function NavZone(props: { title: string }) {
    return (
        <div className='navZone'>
            <FontAwesomeIcon className="navZone-icon" icon={faGreaterThan} />
            <h1 className='navZone-text'>{props.title}</h1>
        </div>
    );
}
