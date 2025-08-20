interface RoomLabelProps {
    room: {
        idRoom: string;
        description: string;
        active?: boolean;
        office: {
            idOffice: string;
            description: string;
            openingTime: string;
            closingTime: string;
            active?: boolean;
            city: {
                idCity: string;
                nameCity: string;
                active?: boolean;
                province: {
                    idProvince: string;
                    nameProvince: string;
                    active?: boolean;
                };
            };
        };
    };
    active?: boolean;
}

export function RoomLabel({ room, active }: RoomLabelProps){
    return (
        <div className={`${active && room.office.active? 'crud-label-green' : 
            active && !room.office.active? 'crud-label-green-inactive': 
            !active && room.office.active? 'crud-label-red' : 'crud-label-red-inactive'} crud-label city-label`}>
            <p className="crud-id">ID: {room.idRoom}</p>
            <p className="crud-name">{room.description}</p>
            <p className="crud-name">{room.office.description}</p>
            <p className="crud-name">{room.office.city.nameCity}</p>
        </div>
    );
}