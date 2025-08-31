import { useState, useEffect } from "react";
import "../../adminHome/AdminHome.css";
import { ProvinceLabel } from "./ProvinceLabel.tsx";
import { FaSearch } from 'react-icons/fa';
import { ProvinceModal } from "./ProvinceModal.tsx";
import "../adminCRUDS.css";
import { NavZone } from "../../../components/navZone/NavZone.tsx";
import { FaPlus } from "react-icons/fa";
import api from '../../../axios';
import { toast, ToastContainer } from "react-toastify";


export function ProvincesAdmin() {

    interface Province {
        idProvince: string;
        nameProvince: string;
        active: boolean;
    }

    const [provinces, setProvinces] = useState<Province[]>([]);
    const [filteredProvinces, setFilteredProvinces] = useState<Province[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedProvince, setSelectedProvince] = useState<Province | null>(null);
    const [modalAction, setModalAction] = useState<'create' | 'edit'>('create');

    useEffect(() => {
        api.get('/provinces')
            .then(data => {
                console.log('Provinces fetched:', data.data);
                setLoading(false);
                setProvinces(data.data);
                setFilteredProvinces(data.data.sort((a: Province, b: Province) => Number(b.active) - Number(a.active)));

            })
            .catch(error => {
                setLoading(false);
                toast.error(`Error al obtener las provincias: ${error.message}`);
            });
    }, []);

    useEffect(() => {
        setFilteredProvinces(
            provinces.filter((province: Province) => province.nameProvince.normalize("NFD").replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '').toLowerCase().includes(searchTerm.normalize("NFD").replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '').toLowerCase()))
        );

    }, [searchTerm, provinces]);

    if (loading) {
        return <div className="loading">Loading...</div>;
    }

    function addProvince(nameProvince: string) {
        if (!nameProvince.trim()) return;

      api.post('/provinces', {
          nameProvince: nameProvince,
          active: true
      })
      .then(created => {
        // añadimos la provincia nueva al array
        toast.success(`Provincia creada!`);
        setModalVisible(false);
        setProvinces([created.data, ...provinces]);
      })
      .catch(err => {
        toast.error(`Error al crear provincia: ${err.message}`);
        });
      }


  function deleteProvince(id: string) {
    if (!id) return;

    api.patch(`/provinces/${id}/toggle-state`)
      .then(() => {
        // Eliminamos la provincia del array
        setProvinces(provinces.map(prov => prov.idProvince !== id ? prov : { ...prov, active: false }));
        toast.success(`Provincia eliminada!`);
        setModalVisible(false);
      })
      .catch(err => {
        toast.error(`Error al eliminar provincia: ${err.message}`);
      });
  }

  function editProvince(id: string, newName: string, active: boolean) {
    if (!newName) return;

    if(active) {
      api.put(`/provinces/${id}`, {
        nameProvince: newName
      })
      .then(updated => {
        const newProvinces = [updated.data, ...provinces.filter(prov => prov.idProvince !== id)];
        setProvinces(newProvinces);
        toast.success(`Provincia modificada!`);
        setModalVisible(false);
      })
      .catch(err => {
        toast.error(`Error al modificar provincia: ${err.message}`);
        });
      } else {

      api.patch(`/provinces/${id}/toggle-state`)
      .then(res => {
        setProvinces(provinces.map(prov => prov.idProvince !== id ? prov : { ...prov, active: true }));
        toast.success(`Provincia activada!`);
        setModalVisible(false);
      })
      .catch(err => {
        toast.error(`Error al modificar provincia: ${err.message}`);
      });
    }; 
  }

    return (
      <>
        <div className="admin-home">
            <NavZone title="Administrador de Provincias"/>
            <ToastContainer 
                className = {`toast-container`}
                draggable={false}
            />
            <div className="crud-searchBar">
                <FaSearch className="search-icon"/>
                <input className="crud-searchInput"
                    type="text"
                    placeholder="Ingrese el nombre de una provincia"
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="crud-grid">
                <ul className="crud-list">
                    {filteredProvinces.map(prov => (
                    <li key={prov.idProvince} onClick={() => {
                      setModalVisible(true);
                      setModalAction('edit');
                      setSelectedProvince(prov);
                    }}>
                        <ProvinceLabel name={prov.nameProvince} id={prov.idProvince} onDelete={() => deleteProvince(prov.idProvince)} onEdit={() => editProvince(prov.idProvince, "", prov.active)} active={prov.active} />
                    </li>
                ))}
            </ul>
            </div>
            <button className="crud-add-button" onClick={() => (setModalVisible(true), setModalAction('create'))}><strong>Agregar Provincia </strong><FaPlus /></button>

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