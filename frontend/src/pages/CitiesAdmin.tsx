import { useEffect, useState } from "react";
import { CityLabel  } from "../components/CityLabel";   
import { EditCityModal} from "../components/editCityModal";
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
    const [editIsOpen, setEditIsOpen] = useState(false);
    const [editData, setEditData] = useState<City | null>(null);


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
  
    function DeleteCity(id: string) {
        fetch(`/api/cities/${id}`, { method: 'DELETE' })
        .then(async(res) => {
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || res.statusText);
            }
            return res.json();})
        .then(() => {
                setCities(cities.filter(city => city.idCity !== id));
            })
        .catch(err => {
            alert('Error al eliminar ciudad: ' + err.message);
        })
        }

    function EditCity(id: string) {
        const cityToEdit = cities.find(city => city.idCity === id);
        if (cityToEdit) {
            setEditData(cityToEdit);
            setEditIsOpen(true);
        }
    }

    function EditSubmit(updatedCity: { idCity: string; nameCity: string; province: string }){
        if (!editData) return;
        fetch(`/api/cities/${updatedCity.idCity}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                idCity: updatedCity.idCity,
                nameCity: updatedCity.nameCity,
                province: updatedCity.province,
            }),
        })
        .then(async (res) => {
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || res.statusText);
            }
            return res.json();})
        .then(response => {
                const updatedCityFromBackend = response.data;
                setCities(cities.map(city => city.idCity === updatedCityFromBackend.idCity ? updatedCityFromBackend : city));
                setEditIsOpen(false);
                setEditData(null);
            }
        )
        .catch(err => {
            alert('Error al editar ciudad: ' + err.message);
        })
    }

    if (loading) {
        return <div>Loading...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    return (
        <div className="admin-home">
            <h1>Administración de Ciudades</h1>
            <ul className = "cities-list">
                {cities.map(city => (
                    <li key={city.idCity}>
                        <CityLabel key={city.idCity} city={city} onDelete={DeleteCity} onEdit={()=>EditCity(city.idCity)}></CityLabel>
                    </li>
                ))}
            </ul>
        <EditCityModal isOpen={editIsOpen} city={editData} provinces={provinces} onClose={()=> setEditIsOpen(false)} onSave={EditSubmit}/>
        </div>
    );

}