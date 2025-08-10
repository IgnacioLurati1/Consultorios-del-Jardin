import { useState, useEffect } from "react";
import "../styles/AdminHome.css";
import { ProvinceLabel } from "../components/ProvinceLabel";
import { FaSearch } from 'react-icons/fa';


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
            provinces.filter((province: Province) => province.nameProvince.replace(/\p{Diacritic}/gu, '').normalize("NFD").toLowerCase().includes(searchTerm.toLowerCase()))
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
      .then(res => res.json())
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
      })
      .catch(err => {
        alert('Error al eliminar provincia: ' + err.message);
      });
  }

  function editProvince(id: string) {
    const newName = prompt('Nuevo nombre de provincia:');
    if (!newName) return;

    fetch(`/api/provinces/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nameProvince: newName })
    })
      .then(res => res.json())
      .then(updated => {
        // Actualizamos la provincia en el array
        setProvinces(provinces.map(prov => (prov.idProvince === id ? updated.data : prov)));
      })
      .catch(err => {
        alert('Error al modificar provincia: ' + err.message);
      });
  }

    return (
        <div className="admin-home">
            <h1>Provinces Admin</h1>
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
                    <li key={prov.idProvince}>
                        <ProvinceLabel name={prov.nameProvince} id={prov.idProvince} onDelete={() => deleteProvince(prov.idProvince)} onEdit={() => editProvince(prov.idProvince)} />
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
            
    );
}