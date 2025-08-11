interface CityLabelProps {
    city: {
        idCity: string;
        nameCity: string;
        province: {
            nameProvince: string;
        };
    };
}

export function CityLabel({ city }: CityLabelProps){
    return (
        <div className="city-label">
            <p className="idCity">ID: {city.idCity}</p>
            <p className="nameCity"> {city.nameCity}</p>
            <p className="cityNameProvince"> {city.province.nameProvince}</p>
        </div>
    );
}