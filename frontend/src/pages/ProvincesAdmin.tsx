import { useState, useEffect } from "react";
import "../styles/AdminHome.css";
import { ProvinceLabel } from "../components/ProvinceLabel";
import { FaSearch } from 'react-icons/fa';
import { ProvinceModal } from "../components/ProvinceModal";


export function ProvincesAdmin() {

    interface Province {
        idProvince: string;
        nameProvince: string;
    }

    const [provinces, setProvinces] = useState<Province[]>([]);
    const [filteredProvinces, setFilteredProvinces] = useState<Province[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [newName, setNewName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedProvince, setSelectedProvince] = useState<Province | null>(null);

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

    if (loading) {
        return <div>Loading...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }



    function addProvince() {
        if (!newName.trim()) return;
        fetch('/api/provinces', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nameProvince: newName }) // idProvince se genera en el backend
    })
      .then(res => {
        if(res.ok) {
          return res.json();
        }
        throw new Error('El nombre coincide con otra provincia existente');
      })
      .then(created => {
        // añadimos la provincia nueva al array
        console.log('Provincia creada:', created);
        setProvinces([...provinces, created.data]);
        setNewName('');
      })
      .catch(err => {
        alert('Error al crear provincia: ' + err.message);
      });
  };

  function deleteProvince(id: string) {
    fetch(`/api/provinces/${id}`, {
      method: 'DELETE',
    })
      .then(res => {
        if(!res.ok) throw new Error('Error al eliminar provincia');
      })
      .then(() => {
        // Eliminamos la provincia del array
        setProvinces(provinces.filter(prov => prov.idProvince !== id));
        setModalVisible(false);
      })
      .catch(err => {
        alert('Error al eliminar provincia: ' + err.message);
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
        throw new Error('El nombre de la provincia coincide con otra existente');
      })
      .then(updated => {
        const newProvinces = [updated.data, ...provinces.filter(prov => prov.idProvince !== id)];
        setProvinces(newProvinces);
        setModalVisible(false);
      })
      .catch(err => {
        alert('Error al modificar provincia: ' + err.message);
      });
  }

  


    return (
      <>
        {modalVisible && selectedProvince != null && (
            <ProvinceModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                province={selectedProvince}
                onDelete={() => deleteProvince(selectedProvince.idProvince)}
                onEdit={editProvince}
            />
        )
        }
        <div className="admin-home">
            <h1>Administrador de Provincias</h1>
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
                      setSelectedProvince(prov);
                    }}>
                        <ProvinceLabel name={prov.nameProvince} id={prov.idProvince} onDelete={() => deleteProvince(prov.idProvince)} onEdit={() => editProvince(prov.idProvince, "")} />
                    </li>
                ))}
            </ul>
            </div>

            <input
                type="text"
                placeholder="Nombre de provincia"
                value={newName}
                onChange={e => setNewName(e.target.value)}
        />
       <button onClick={addProvince}>Añadir</button>

        </div>
    </> 
    );
}