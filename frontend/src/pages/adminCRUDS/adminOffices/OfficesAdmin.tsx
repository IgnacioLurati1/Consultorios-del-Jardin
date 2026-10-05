import { useEffect, useState } from "react";
import { Toasts } from "../../../components/toast/Toasts.tsx";
import "../../adminCRUDS/adminCRUDS.css";
import { AdminHeader } from "../../../components/adminHeader/AdminHeader.tsx";
import { FaPlus } from "react-icons/fa";
import { OfficeLabel } from "./OfficeLabel.tsx";
import { OfficeModal } from "./OfficeModal.tsx";
import { toast } from "react-toastify";
import type {Office, Province, City} from "../../types.ts";
import SearchBar from "../../../components/searchBar/searchBar.tsx";
import { findAllOffices, createOffice, updateOffice, removeOffice} from "./OfficeService.ts";
import { findAllActiveCities } from "../adminCities/CityService.ts";
import { findAllActiveProvinces } from "../adminProvinces/ProvinceService.ts";
import { currentWords, useWords } from "../../../lib/installation.ts";

export function OfficesAdmin() {
  const w = useWords();

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
              })
        .catch(err => {
            toast.error(`Error al cargar ${currentWords().sucursales}: ${err.message}`);
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
      .then((data) => setCities(data))
      .catch((err) => toast.error(`Error al cargar las ciudades: ${err.message}`))
  }, []);

  useEffect(() => {
    findAllActiveProvinces()
    .then(data => {
      setProvinces(data);
       })
      .catch(err => toast.error(`Error al cargar las provincias: ${err.message}`))
      
  }, []);

  async function addOffice(description: string, openingTime: string, closingTime:string, city:string, address: string) {

    // Sin esto un rechazo del servidor (una sucursal repetida, por ejemplo) no se veía.
    try {
      const createdOffice = await createOffice( description, openingTime, closingTime, city, address)
      if(createdOffice){
        setOffices([createdOffice, ...offices]);
        toast.success(`${w.Sucursal} cread${w.o("sucursal")} con éxito`);
        setModalVisible(false);
      }
    } catch (error) {
      toast.error(`Error al crear ${w.el("sucursal")}. ${(error as Error).message}`);
    }
  }

  async function deleteOffice(id: string){
    try{
    if(await removeOffice(id)){
      setOffices(offices.map(office => office.idOffice !== id? office: {...office, active:false}));
      toast.success(`${w.Sucursal} eliminad${w.o("sucursal")} con éxito`);
      setModalVisible(false);
    }
  } catch (error:any){
    toast.error(`Error al eliminar ${w.el("sucursal")}: ${error.message}`);
  }
}

  async function editOffice(id: string, description: string, openingTime: string, closingTime: string, cityId: string, active: boolean, address?: string){
    try{
    const updatedOffice = await updateOffice(id, description, openingTime, closingTime, cityId, active, address);
    if(active && updatedOffice){
      toast.success(`${w.Sucursal} modificad${w.o("sucursal")} con éxito`);
      setModalVisible(false);
      setOffices(offices.map(office => office. idOffice !== id? office: updatedOffice));
    } 
      else if(!active){
      setOffices(offices.map(office => office.idOffice !== id? office: {...office, active: true}));
      toast.success(`${w.Sucursal} reactivad${w.o("sucursal")} con éxito`);
      setModalVisible(false);
    }
  } catch (error:any){
    toast.error(`Error al modificar ${w.el("sucursal")}: ${error.message}`);
  }
}
    
  return (
        <div className="admin-home">

            <AdminHeader title={w.Sucursales} subtitle="Sedes, con su horario de apertura y cierre" />
            <Toasts />
            <SearchBar searchHook={setSearchTerm} placeHolderText={`Ingrese la descripción de ${w.un("sucursal")}`} />
            <div className={!loading ? "crud-grid" : "crud-grid skeleton-loading"}>
              {(!loading && offices.length === 0) ? (
                    <div className= "no-content"> {`No hay ${w.sucursales} cargad${w.os("sucursal")}`} </div>
                ): !loading && (
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
                </ul>)}   
            </div>
            <div>
                <button className="crud-add-button" onClick={()=>{setModalVisible(true) ; setEditData(emptyOffice);setModalType("create")}}><strong>{`Agregar ${w.Sucursal}`}</strong><FaPlus /></button>
            </div>
            <OfficeModal visible={modalVisible} office={editData} provinces={provinces} cities={cities} onClose={()=> setModalVisible(false)} onEdit={editOffice} onDelete={deleteOffice} onCreate={addOffice} action = {modalType}/>
        </div>
    );
}