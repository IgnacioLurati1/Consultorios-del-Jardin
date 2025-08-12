import { useState, useEffect } from "react";
import "../styles/AdminHome.css";
import { ProvinceLabel } from "../components/ProvinceLabel";
import { FaSearch } from 'react-icons/fa';
import { ProvinceModal } from "../components/ProvinceModal";
import "../styles/ProvincesCRUD.css";
import { NavZone } from "../components/NavZone.tsx";
import { FaPlus } from "react-icons/fa";



export function ProvincesAdmin() {

    interface Province {
        idProvince: string;
        nameProvince: string;
    }

    const [provinces, setProvinces] = useState<Province[]>([]);
    const [filteredProvinces, setFilteredProvinces] = useState<Province[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any>();
    const [searchTerm, setSearchTerm] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedProvince, setSelectedProvince] = useState<Province | null>(null);
    const [modalAction, setModalAction] = useState<'create' | 'edit'>('create');

    useEffect(() => {
        fetch('/api/provinces')
            .then(response => response.json())
            .then(data => {
                console.log('Provinces fetched:', data.data);
                setLoading(false);
                setProvinces(data.data);
                setFilteredProvinces(data.data);

            })
            .catch(error => {
                setLoading(false);
                setError(error.message);
                console.error('Error fetching provinces:', error);
            });
    }, []);

    useEffect(() => {
        setFilteredProvinces(
            provinces.filter((province: Province) => province.nameProvince.normalize("NFD").replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '').toLowerCase().includes(searchTerm.normalize("NFD").replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '').toLowerCase()))
        );

    }, [searchTerm, provinces]);

    useEffect(() => {
        if (error == null) return;
        setTimeout(() => { 
          setError(null);  
        }, 12000);
    }, [error]);

    if (loading) {
        return <div>Loading...</div>;
    }

    function addProvince(nameProvince: string) {
        if (!nameProvince.trim()) return;
        fetch('/api/provinces', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nameProvince: nameProvince }) // idProvince se genera en el backend
    })
      .then(res => {
        if(!res.ok) {
          setModalVisible(false);
          throw new Error('El nombre coincide con otra provincia existente');
        }
        return res.json();
        
      })
      .then(created => {
        // añadimos la provincia nueva al array
        console.log('Provincia creada:', created);
        setModalVisible(false);
        setError({});
        setProvinces([...provinces, created.data]);
      })
      .catch(err => {
        setError({ baseMessage: "Error al crear provincia: ",
                  detail: err.message
        });
      });
  };

  function deleteProvince(id: string) {
    if (!id) return;

    fetch(`/api/provinces/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false })
    })
      .then(() => {
        // Eliminamos la provincia del array
        setProvinces(provinces.filter(prov => prov.idProvince !== id));
        setError({});
        setModalVisible(false);
      })
      .catch(err => {
        setError({ baseMessage: "Error al eliminar provincia: ",
          detail: err.message
        });
      });
  }

  function editProvince(id: string, newName: string) {
    if (!newName) return;

    fetch(`/api/provinces/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nameProvince: newName })
    })
      .then(res => {
        if(res.ok) {
          return res.json();
        }
        setModalVisible(false);
        throw new Error('El nombre de la provincia coincide con otra existente');
      })
      .then(updated => {
        const newProvinces = [updated.data, ...provinces.filter(prov => prov.idProvince !== id)];
        setProvinces(newProvinces);
        setError({});
        setModalVisible(false);
      })
      .catch(err => {
        setError({ baseMessage: "Error al modificar provincia: ",
          detail: err.message
        });
      });
  }

  
    return (
      <>
        <div className="admin-home">
            <NavZone title="Administrador de Provincias"/>
            <div className="province-searchBar">
                <FaSearch className="search-icon"/>
                <input className="province-searchInput"
                    type="text"
                    placeholder="Ingrese el nombre de una provincia"
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="province-grid">
                <ul className="province-list">
                    {filteredProvinces.map(prov => (
                    <li key={prov.idProvince} onClick={() => {
                      setModalVisible(true);
                      setModalAction('edit');
                      setSelectedProvince(prov);
                    }}>
                        <ProvinceLabel name={prov.nameProvince} id={prov.idProvince} onDelete={() => deleteProvince(prov.idProvince)} onEdit={() => editProvince(prov.idProvince, "")} />
                    </li>
                ))}
            </ul>
            </div>
            <button className="add-button" onClick={() => (setModalVisible(true), setModalAction('create'))}><strong>Agregar Provincia </strong><FaPlus /></button>

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

            {error != null && (
                <p className="error-message"><strong>{error.baseMessage}</strong>{error.detail}</p>
            )}

        </div>
    </> 
    );
}