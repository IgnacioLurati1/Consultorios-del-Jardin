import "../CRUDSLabel.css";
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faLocationDot} from '@fortawesome/free-solid-svg-icons';



export function OfficeLabel(office: {description: string, id: string, openingTime: string, closingTime: string, city: string, onDelete: () => void, onEdit: () => void, active: boolean}) {
  return (
    <div className={`${office.active ? 'crud-label-green' : 'crud-label-red'} crud-label room-label`}>
      <div className="room-label-container">
        <div className="room-label-upper">
          <p className="crud-id"> ID: {office.id}</p>
          <p className="crud-name">{office.description}</p>
        </div>
        <hr />
        <div className="room-label-lower">
          <p className="crud-name">De {office.openingTime}hs a {office.closingTime}hs</p>
          <p className="crud-name">{office.city}<FontAwesomeIcon className="icon-location"icon={faLocationDot}/></p>
        </div>
      </div>
    </div>
  );
}

//no es responsive.