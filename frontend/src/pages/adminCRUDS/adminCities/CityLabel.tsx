interface CityLabelProps {
    city: {
        idCity: string;
        nameCity: string;
        province: {
            nameProvince: string;
            active?: boolean;
        };
        active: boolean;
    };
    
}

export function CityLabel({ city }: CityLabelProps){
    return (
        <div className={`${city.active? 'crud-label-green' : 'crud-label-red'} crud-label city-label`}>
            <p className="crud-id">ID: {city.idCity}</p>
            <p className="crud-name city">{city.nameCity}</p>
            <p className="crud-name">{city.province.nameProvince}</p>
        </div>
    );
}