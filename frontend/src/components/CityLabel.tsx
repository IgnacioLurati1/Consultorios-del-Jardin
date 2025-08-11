interface CityLabelProps {
    city: {
        idCity: string;
        nameCity: string;
        province: {
            nameProvince: string;
        };
    };
    onDelete: (id: string) => void;
    onEdit: () => void;
}

export function CityLabel({ city, onDelete, onEdit }: CityLabelProps){
    return (
        <div className="city-label">
            <p className="idCity">ID: {city.idCity}</p>
            <p className="nameCity"> {city.nameCity}</p>
            <p className="cityNameProvince"> {city.province.nameProvince}</p>
            <button className="editCity-button" onClick = {()=> onEdit()}>Editar</button>
            <button className="deleteCity-button" onClick = {() => onDelete(city.idCity)}> Eliminar </button>
        </div>
    );
}