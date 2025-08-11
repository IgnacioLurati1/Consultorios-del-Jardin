import { useEffect, useState } from "react";
import { CityLabel  } from "../components/CityLabel";   
import {CityModal} from "../components/CityModal";
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
    const [filteredCities, setFilteredCities] = useState<City[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [editData, setEditData] = useState<City | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [modalType, setModalType] = useState("");
    const emptyCity: City = { idCity: "", nameCity: "", province: { idProvince: "", nameProvince: "" } };

    function addCity(newCity: { nameCity: string; province: string }) {
        fetch("/api/cities", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(newCity),
        })
        .then(async (res) => {
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || res.statusText);
            }
            return res.json();})
        .then(response => {
            setCities([...cities, response.data]);
            setModalVisible(false);
        })
        .catch(err => {
            alert('Error al crear ciudad: ' + err.message);
        });
    }

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
        setFilteredCities(data.data);
        setLoading(false);
      })
      .catch(err => {
        setLoading(false);
        setError(err.message);
        console.error("Error cargando ciudades:", err)});
    }, []);
  
    useEffect(() => {
        setFilteredCities(
            cities.filter((city: City) => city.nameCity.normalize("NFD").replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '').toLowerCase().includes(searchTerm.normalize("NFD").replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '').toLowerCase()))
        );

    }, [searchTerm, cities]);

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

    function EditCity(updatedCity: { idCity: string; nameCity: string; province: string }){
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
                setModalVisible(false);
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
            <h1>Administrador de Ciudades</h1>
            <div className="city-searchBar">
                <input className="city-searchInput"
                type="text"
                placeholder="Ingrese el nombre de la ciudad"
                onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="city-grid">
                <ul className = "cities-list">
                    {filteredCities.map(city => (
                        <li key={city.idCity}
                        onClick={()=>{setModalVisible(true); setEditData(city); setModalType("edit")}}>
                            <CityLabel key={city.idCity} city={city}></CityLabel>
                        </li>
                    ))}
                </ul>
            </div>
            <div>
                <button className="createCity" onClick={()=>{setModalVisible(true) ; setEditData(emptyCity);setModalType("create")}}>Agregar ciudad</button>
            </div>
            <CityModal visible={modalVisible} city={editData} provinces={provinces} onClose={()=> setModalVisible(false)} onEdit={EditCity} onDelete={DeleteCity} onCreate={addCity} type = {modalType} />
        </div>
    );

}