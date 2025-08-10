export function CityLabel({ city, onDelete }: { city: { idCity: string; nameCity: string; province: { nameProvince: string } }; 
    onDelete: (id: string) => void }) {
    return (
        <div className="city-label">
            <p className="idCity">ID: {city.idCity}</p>
            <p className="nameCity"> {city.nameCity}</p>
            <p className="cityNameProvince"> {city.province.nameProvince}</p>
            <button className="editCity-button">Editar</button>
            <button className="deleteCity-button" onClick = {() => onDelete(city.idCity)}> Eliminar </button>
        </div>
    );
}