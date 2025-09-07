import "../CRUDSLabel.css";
import "./OfficeLabel.css";
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faLocationDot} from '@fortawesome/free-solid-svg-icons'
import type {OfficeLabelProps} from "./typesOffice.tsx"

export function OfficeLabel({ office,  active }: OfficeLabelProps){
  return (
    <div className={`${active ? 'crud-label-green' : 'crud-label-red'} crud-label office-label`}>
      <div className="office-label-row-1">
        <p className="crud-name">{office.description}</p>
        <p className="crud-id">ID: {office.idOffice}</p>
      </div>
      <hr />
      <div className="office-label-row-2">
        <p className="crud-name">De {office.openingTime}hs a {office.closingTime}hs</p>
        <p className="crud-name">{office.city.nameCity}<FontAwesomeIcon className="icon-location"icon={faLocationDot}/></p>
      </div>
    </div>
  );
}