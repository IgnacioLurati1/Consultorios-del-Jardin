interface CityLabelProps {
    city: {
        idCity: string;
        nameCity: string;
        province: {
            nameProvince: string;
            active?: boolean;
        };
    };
    active?: boolean;
}

export function CityLabel({ city, active }: CityLabelProps){
    return (
        <div className={`${active && city.province.active? 'crud-label-green' : 
            active && !city.province.active? 'crud-label-green-inactive': 
            !active && city.province.active? 'crud-label-red' : 'crud-label-red-inactive'} crud-label city-label`}>
            <p className="crud-id">ID: {city.idCity}</p>
            <p className="crud-name">{city.nameCity}</p>
            <p className="crud-name">{city.province.nameProvince}</p>
        </div>
    );
}