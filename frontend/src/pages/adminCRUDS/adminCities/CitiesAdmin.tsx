import { useEffect, useState } from "react";
import { CityLabel  } from "./CityLabel";   
import {CityModal} from "./CityModal";
import "../../adminHome/AdminHome.css";
import "../adminCRUDS.css";
import { NavZone } from "../../../components/navZone/NavZone";
import { FaSearch } from 'react-icons/fa';
import { FaPlus } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";

export function CitiesAdmin() {

    interface Province {
    idProvince: string;
    nameProvince: string;
    active?: boolean;
    }

    interface City {
        idCity: string;
        nameCity: string;
        province: Province;
        active: boolean;
    }

    const [provinces, setProvinces] = useState<Province[]>([]);
    const [cities, setCities] = useState<City[]>([]);
    const [filteredCities, setFilteredCities] = useState<City[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editData, setEditData] = useState<City | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [modalType, setModalType] = useState("");
    const emptyCity: City = { idCity: "", nameCity: "", province: { idProvince: "", nameProvince: ""}, active: true };

    useEffect(() => {
    fetch("/api/provinces")
      .then(res => res.json())
      .then(data => {
        setProvinces(data.data.filter((province: Province) => province.active));
        setLoading(false); })
      .catch(err => {
        setLoading(false);
        toast.error("Error cargando provincias:" + err)});
    }, []);

    useEffect(() => {
    fetch("/api/cities")
      .then(res => res.json())
      .then(data => {
        setCities(data.data)
        setFilteredCities(
            data.data.sort((a: City, b: City) => {
                function weight(city: City) {
                if (city.province.active) {
                    return city.active ? 1 : 2;  // provincia activa: ciudad activa=1, ciudad inactiva=2
                } else {
                    return city.active ? 3 : 4;  // provincia inactiva: ciudad activa=3, ciudad inactiva=4
                }
                }
                return weight(a) - weight(b);
            })
            );
        setLoading(false);
      })
      .catch(err => {
        setLoading(false);
        toast.error("Error cargando ciudades: " + err.message);});
    }, []);
  
    useEffect(() => {
        setFilteredCities(
            cities.filter((city: City) => city.nameCity.normalize("NFD").replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '').toLowerCase().includes(searchTerm.normalize("NFD").replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '').toLowerCase()))
        );

    }, [searchTerm, cities]);

    function addCity(newCity: { nameCity: string; province: string }) {
            fetch("/api/cities", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(newCity),
            })
            .then(res => {
                if (!res.ok) {
                    throw new Error(res.statusText);
                }
                return res.json();})
            .then(response => {
                setCities([response.data, ...cities]);
                setModalVisible(false);
                toast.success("Ciudad creada exitosamente");
            })
            .catch(err => {
                toast.error('Error al crear ciudad: ' + err.message);
            });
        }

    function deleteCity(id: string) {
    if (!id) return;

    fetch(`/api/cities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false })
    })
      .then(async(res) => {
        if(!res.ok) {
        const errorData = await res.json();
          throw new Error(errorData.message || res.statusText);
        }
        return res.json();
      })
      .then(() => {
        setCities(cities.map(city => city.idCity !== id ? city : { ...city, active: false }));
        setModalVisible(false);
        toast.success("Ciudad eliminada exitosamente");
      })
        .catch(err => {
            toast.error('Error al eliminar ciudad: ' + err.message);
        });
  }

    function EditCity(updatedCity: { idCity: string; nameCity: string; province: string} , active: boolean) {
        if (!editData) return;
        if(active){
        fetch(`/api/cities/${updatedCity.idCity}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
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
                toast.success("Ciudad editada exitosamente");
            }
        )
        .catch(err => {
           toast.error('Error al editar ciudad: ' + err.message);
        })}
        else{
            fetch(`/api/cities/${updatedCity.idCity}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    active: true
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
                    setCities(cities.map(city => city.idCity !== updatedCityFromBackend.idCity ? city : { ...city, active: true }));
                    setModalVisible(false);
                    setEditData(null);
                    toast.success("Ciudad reactivada exitosamente");
                }
            )
            .catch(err => {
                toast.error('Error reactivar ciudad: ' + err.message);
            });
        }
    }

    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <div className="admin-home">

            <NavZone title="Administrador de Ciudades"/>
            <ToastContainer 
                className = {`toast-container`}
                draggable={false}
            />
            <div className="crud-searchBar">
                <FaSearch className="search-icon"/>
                <input className="crud-searchInput"
                type="text"
                placeholder="Ingrese el nombre de la ciudad"
                onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="crud-grid">
                <ul className = "crud-list">
                    {filteredCities.map(city => (
                        <li key={city.idCity}
                        onClick={()=>{
                            setEditData(city);
                            setModalVisible(true); 
                            setModalType("edit")
                            }}>
                            <CityLabel key={city.idCity} city={city} active={city.active}></CityLabel>
                        </li>
                    ))}
                </ul>
            </div>
            <div>
                <button className="crud-add-button" onClick={()=>{setModalVisible(true) ; setEditData(emptyCity);setModalType("create")}}><strong>Agregar ciudad</strong><FaPlus /></button>
            </div>
            <CityModal visible={modalVisible} city={editData} provinces={provinces} onClose={()=> setModalVisible(false)} onEdit={EditCity} onDelete={deleteCity} onCreate={addCity} type = {modalType}/>
        </div>
    );

}