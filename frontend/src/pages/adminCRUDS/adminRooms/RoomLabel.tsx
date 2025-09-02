import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faLocationDot} from '@fortawesome/free-solid-svg-icons'
import type {RoomLabelProps} from "./typesRoom.tsx"

export function RoomLabel({ room, active }: RoomLabelProps){
    return (
        <div className={`${active && room.office.active? 'crud-label-green' : 
            active && !room.office.active? 'crud-label-green-inactive': 
            !active && room.office.active? 'crud-label-red' : 'crud-label-red-inactive'} crud-label room-label`}>
            <div className="room-label-container">
                <div className="room-label-upper">
                    <p className="crud-id">ID: {room.idRoom}</p>
                    <p className="crud-name">{room.description}</p>
                </div>
                <hr />
                <div className="room-label-lower">
                    <p className="crud-name">{room.office.description}</p>
                    <p className="crud-name">{room.office.city.nameCity}<FontAwesomeIcon className="icon-location"icon={faLocationDot}/></p> 
                </div>
            </div>
        </div>
    );
}