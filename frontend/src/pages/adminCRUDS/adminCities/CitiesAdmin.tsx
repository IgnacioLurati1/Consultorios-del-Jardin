import { useEffect, useState } from "react";
import { CityLabel  } from "./CityLabel";   
import {CityModal} from "./CityModal";
import "../../homePages/adminHome/AdminHome.css"
import "../adminCRUDS.css";
import { NavZone } from "../../../components/navZone/NavZone";
import { FaPlus } from "react-icons/fa";
import { ToastContainer } from "react-toastify";
import { findAllCities, createCity, removeCity, updateCity} from "./CityService.ts";
import { findAllActiveProvinces} from "../adminProvinces/ProvinceService.ts"
import type {Province, City} from "../../types.ts";
import SearchBar from "../../../components/searchBar/searchBar.tsx";

export function CitiesAdmin() {

    const [provinces, setProvinces] = useState<Province[]>([]);
    const [cities, setCities] = useState<City[]>([]);
    const [filteredCities, setFilteredCities] = useState<City[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editData, setEditData] = useState<City | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [modalType, setModalType] = useState("");
    const emptyCity: City = { idCity: "", nameCity: "", province: { idProvince: "", nameProvince: "", active:true}, active: true };

    useEffect(() => {
        findAllActiveProvinces()
        .then(data => {
        setProvinces(data.filter((province: Province) => province.active));
        setLoading(false); });
    }, []);

    useEffect(() => {
        findAllCities()
        .then(data => {
            setCities(data)
        setFilteredCities(
            data.sort((a: City, b: City) => {
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
      });
    }, []);
  
    useEffect(() => {
        setFilteredCities(
            cities.filter((city: City) => city.nameCity.normalize("NFD").replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '').toLowerCase().includes(searchTerm.normalize("NFD").replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '').toLowerCase()))
        );

    }, [searchTerm, cities]);

    async function addCity(newCity: { nameCity: string; province: string }) {
        const createdCity = await createCity(newCity)
        if(createdCity){
            setCities([createdCity, ...cities]);
            setModalVisible(false);
        }
    }

    async function deleteCity(id: string) {
    if (await removeCity(id)){
        setCities(cities.map(city => city.idCity !== id ? city : { ...city, active: false }));
        setModalVisible(false);
    }
  }

    async function EditCity(updatedCity: { idCity: string; nameCity: string; province: string} , active: boolean) {
        
        const updatedCityFromBackend = await updateCity(updatedCity, active);
        if(active && updatedCityFromBackend){
            setCities(cities.map(city => city.idCity === updatedCityFromBackend.idCity ? updatedCityFromBackend : city));
            setModalVisible(false);
            setEditData(null);
        }
        else if(!active){
            setCities(cities.map(city => city.idCity !== updatedCity.idCity ? city : { ...city, active: true }));
            setModalVisible(false);
            setEditData(null);
        }
    }

    return (
        <div className="admin-home">

            <NavZone title="Administrador de Localidades"/>
            <ToastContainer 
                className = {`toast-container`}
                draggable={false}
            />
            <SearchBar searchHook={setSearchTerm} placeHolderText="Ingrese el nombre de una localidad" />
            <div className={!loading ? "crud-grid" : "crud-grid skeleton-loading"}>
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
                <button className="crud-add-button" onClick={()=>{setModalVisible(true) ; setEditData(emptyCity);setModalType("create")}}><strong>Agregar Localidad</strong><FaPlus /></button>
            </div>
            <CityModal visible={modalVisible} city={editData} provinces={provinces} onClose={()=> setModalVisible(false)} onEdit={EditCity} onDelete={deleteCity} onCreate={addCity} type = {modalType}/>
        </div>
    );

}