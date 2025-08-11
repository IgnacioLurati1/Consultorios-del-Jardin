import { useEffect, useState } from "react";
import { CityLabel  } from "../components/CityLabel";   
import "../styles/AdminHome.css";

export function CitiesAdmin() {

    interface Province {
    idProvince: string;
    nameProvince: string;
    }

    interface City {
        idCity: string;
        nameCity: string;
        province: Province; 
    }

    const [provinces, setProvinces] = useState<Province[]>([]);
    const [cities, setCities] = useState<City[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [nameCity, setNameCity] = useState("");
    const [selectedProvince, setSelectedProvince] = useState("");


    useEffect(() => {
    fetch("/api/provinces")
      .then(res => res.json())
      .then(data => {
        setProvinces(data.data)
        setLoading(false); })
      .catch(err => {
        setLoading(false);
        setError(err.message);console.error("Error cargando provincias:", err)});
    }, []);

    useEffect(() => {
    fetch("/api/cities")
      .then(res => res.json())
      .then(data => {
        setCities(data.data)
        setLoading(false);
      })
      .catch(err => {
        setLoading(false);
        setError(err.message);
        console.error("Error cargando ciudades:", err)});
    }, []);
  
    if (loading) {
        return <div>Loading...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    function DeleteCity(id: string) {
        fetch(`/api/cities/${id}`, { method: 'DELETE' })
        .then(res => {
            if (!res.ok) {
                throw new Error(`Error al eliminar ciudad: ${res.statusText}`);
            }
            return res.json();})
        .then(() => {
                setCities(cities.filter(city => city.idCity !== id));
            })
        .catch(err => {
            alert('Error al eliminar ciudad: ' + err.message);
        })
        }

    return (
        <div className="admin-home">
            <h1>Administración de Ciudades</h1>
            <ul className = "cities-list">
                {cities.map(city => (
                    <li key={city.idCity}>
                        <CityLabel key={city.idCity} city={city} onDelete={DeleteCity}></CityLabel>
                    </li>
                ))}
            </ul>
        </div>
    );

}