import { useState, useEffect } from "react";
import "../../homePages/adminHome/AdminHome.css"
import { ProvinceLabel } from "./ProvinceLabel.tsx";
import { ProvinceModal } from "./ProvinceModal.tsx";
import "../adminCRUDS.css";
import { NavZone } from "../../../components/navZone/NavZone.tsx";
import { FaPlus } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import { createProvince, removeProvince, updateProvince, findAllProvinces } from "./ProvinceService.ts";  
import type { Province } from "../../types.ts";
import SearchBar from "../../../components/searchBar/searchBar.tsx";

export function ProvincesAdmin() {

  const [provinces, setProvinces] = useState<Province[]>([]);
  const [filteredProvinces, setFilteredProvinces] = useState<Province[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState<Province | null>(null);
  const [modalAction, setModalAction] = useState<'create' | 'edit'>('create');

  useEffect(() => {
        findAllProvinces()
        .then(data => {
            setLoading(false);
            setProvinces(data);
            setFilteredProvinces(data.sort((a: Province, b: Province) => Number(b.active) - Number(a.active)));
        })
        .catch(err => {
          toast.error(`Error cargando provincias: ${err.message}`);
          setLoading(false);
        });
    }, []);

  useEffect(() => {
        setFilteredProvinces(
            provinces.filter((province: Province) => province.nameProvince.normalize("NFD").replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '').toLowerCase().includes(searchTerm.normalize("NFD").replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '').toLowerCase()))
        );

    }, [searchTerm, provinces]);

// Handlers

  async function addProvince(newName: string) {
    try{
    const createdProvince = await createProvince(newName);
    if (createdProvince) {
        setProvinces([createdProvince, ...provinces]);
        toast.success('Provincia creada con éxito');
        setModalVisible(false);
      }
  } catch (err: any) {
    toast.error(`Error al crear provincia: ${err.message}`);
  }
}

  async function deleteProvince(id: string) {
    try{
    if(await removeProvince(id)) {
      setProvinces(provinces.map(prov => prov.idProvince !== id ? prov : { ...prov, active: false }));
      toast.success('Provincia eliminada con éxito');
      setModalVisible(false);
    }
  } catch (err: any) {
    toast.error(`Error al eliminar provincia: ${err.message}`);
  }
}

  async function editProvince(id: string, newName: string, active: boolean) {
    try{
    const updatedProvince = await updateProvince(id, newName, active);
    if (active && updatedProvince) {
      setProvinces(provinces.map(prov => prov.idProvince !== id ? prov : updatedProvince));
      toast.success('Provincia modificada con éxito');
      setModalVisible(false);
    } else if(!active) {
      setProvinces(provinces.map(prov => prov.idProvince !== id ? prov : { ...prov, active: true }));
      toast.success('Provincia reactivada con éxito');
      setModalVisible(false);
    }
  } catch (err: any) {
    toast.error(`Error al modificar provincia: ${err.message}`);
  }
}

  // Jsx 
    return (
      <>
        <div className="admin-home">
            <NavZone title="Administrador de Provincias"/>
            <ToastContainer 
                className = {`toast-container`}
                draggable={false}
            />
            <SearchBar searchHook={setSearchTerm} placeHolderText="Ingrese el nombre de una provincia" />
            <div className={!loading ? "crud-grid" : "crud-grid skeleton-loading"}>
              {provinces.length === 0 && !loading ? (
                    <div className= "no-content"> No hay provincias cargadas </div>
                ):(
                <ul className="crud-list">
                    {filteredProvinces.map(prov => (
                    <li key={prov.idProvince} onClick={() => {
                      setModalVisible(true);
                      setModalAction('edit');
                      setSelectedProvince(prov);
                    }}>
                        <ProvinceLabel name={prov.nameProvince} onDelete={() => deleteProvince(prov.idProvince)} onEdit={() => editProvince(prov.idProvince, "", prov.active)} active={prov.active} />
                    </li>
                ))}
                </ul>)}
            </div>
          <div><button className="crud-add-button" onClick={() => (setModalVisible(true), setModalAction('create'))}><strong>Agregar Provincia </strong><FaPlus /></button></div>
           {selectedProvince != null && modalAction === "edit" && (
            <ProvinceModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                province={selectedProvince}
                onDelete={() => deleteProvince(selectedProvince.idProvince)}
                onEdit={editProvince}
                action={modalAction}
                onCreate={() => {}}
            />)}

            {modalAction === "create" && (
            <ProvinceModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                province={null}
                onCreate={addProvince}
                onEdit={() => {}}
                onDelete={() => {}}
                action={modalAction}
            />)}
        </div>
    </> 
    );
}