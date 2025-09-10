import { useEffect, useState } from "react";
import "../../adminCRUDS/adminCRUDS.css";
import { NavZone } from "../../../components/navZone/NavZone.tsx";
import { FaPlus } from "react-icons/fa";
import { OfficeLabel } from "./OfficeLabel.tsx";
import { OfficeModal } from "./OfficeModal.tsx";
import { ToastContainer } from "react-toastify";
import type {Office, Province, City} from "../../types.ts";
import SearchBar from "../../../components/searchBar/searchBar.tsx";
import { findAllOffices, createOffice, updateOffice, removeOffice} from "./OfficeService.ts";
import { findAllActiveCities } from "../adminCities/CityService.ts";
import { findAllActiveProvinces } from "../adminProvinces/ProvinceService.ts";

export function OfficesAdmin() {

  const [offices, setOffices] = useState<Office[]>([]);
  const [filteredOffices, setFilteredOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [editData, setEditData] = useState<Office | null>(null);
  const [modalType, setModalType] = useState("");

  const emptyOffice : Office ={
    idOffice: "",
    description: "",
    openingTime: "",
    closingTime: "",
    active: true,
    city: {
      idCity: "",
      nameCity: "",
      active: true,
        province: {
          idProvince: "",
          nameProvince: "",
          active: true,
        }
    }
  }

  useEffect(() => {
        findAllOffices()
        .then(data => {
            setOffices(data)
            setFilteredOffices(
                data.sort((a: Office, b: Office) => {
                    function weight(office: Office) {
                    if (office.active) {
                        return office.active ? 1 : 2;
                    } else {
                        return office.active ? 3 : 4;
                    }
                    }
                    return weight(a) - weight(b);
                })
                );
            setLoading(false);
        });
    }, []);

  useEffect(() => {
  setFilteredOffices(
    offices.filter((office: Office) => {
      if (!office.description) return false;
      
      return office.description
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/\s+/g, "")
        .toLowerCase()
        .includes(
          searchTerm
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .replace(/\s+/g, "")
            .toLowerCase()
        );
    })
  );
}, [searchTerm, offices]);

  useEffect(() => {
    findAllActiveCities()
    .then(data => {
      setCities(data);
      setLoading(false); })
  }, []);

  useEffect(() => {
    findAllActiveProvinces()
    .then(data => {
      setProvinces(data);
      setLoading(false); })
  }, []);

//async functions------------------

  async function addOffice(description: string, openingTime: string, closingTime:string, city:string) {

    const createdOffice = await createOffice( description, openingTime, closingTime, city)
    if(createdOffice){
      setOffices([createdOffice, ...offices]);
      setModalVisible(false);
    }
  }

  async function deleteOffice(id: string){
    if(await removeOffice(id)){
      setOffices(offices.map(office => office.idOffice !== id? office: {...office, active:false}));
      setModalVisible(false);
    }
  }

  async function editOffice(id: string, description: string, openingTime: string, closingTime: string, cityId: string, active: boolean){
    const updatedOffice = await updateOffice(id, description, openingTime, closingTime, cityId, active);
    if(active && updatedOffice){
      setModalVisible(false);
      setOffices(offices.map(office => office. idOffice !== id? office: updatedOffice));
    } 
      else if(!active){
      setOffices(offices.map(office => office.idOffice !== id? office: {...office, active: true}));
      setModalVisible(false);
    }
  }
    
  return (
        <div className="admin-home">

            <NavZone title="Administrador de Consultorio"/>
            <ToastContainer 
                className = {`toast-container`}
                draggable={false}
            />
            <SearchBar searchHook={setSearchTerm} placeHolderText="Ingrese la descripción de un consultorio" />
            <div className={!loading ? "crud-grid" : "crud-grid skeleton-loading"}>
                <ul className = "crud-list">
                    {filteredOffices.map(office => (
                        <li key={office.idOffice}
                        onClick={()=>{
                            setEditData(office);
                            setModalVisible(true); 
                            setModalType("edit")
                            }}>
                            
                            <OfficeLabel key={office.idOffice} office={office} active={office.active}></OfficeLabel>
                        </li>
                    ))}
                </ul>   
            </div>
            <div>
                <button className="crud-add-button" onClick={()=>{setModalVisible(true) ; setEditData(emptyOffice);setModalType("create")}}><strong>Agregar Consultorio</strong><FaPlus /></button>
            </div>
            <OfficeModal visible={modalVisible} office={editData} provinces={provinces} cities={cities} onClose={()=> setModalVisible(false)} onEdit={editOffice} onDelete={deleteOffice} onCreate={addOffice} action = {modalType}/>
        </div>
    );
}