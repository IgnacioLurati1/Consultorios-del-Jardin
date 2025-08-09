import { useState, useEffect } from "react";
import "../styles/AdminHome.css";
import { ProvinceLabel } from "../components/ProvinceLabel";


export function ProvincesAdmin() {

    interface Province {
        idProvince: string;
        nameProvince: string;
    }

    const [provinces, setProvinces] = useState<Province[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [newName, setNewName] = useState('');

    useEffect(() => {
        fetch('/api/provinces')
            .then(response => response.json())
            .then(data => {
                console.log('Provinces fetched:', data.data);
                setLoading(false);
                setProvinces(data.data); //Es asi?
            })
            .catch(error => {
                setLoading(false);
                setError(error.message);
                console.error('Error fetching provinces:', error);
            });
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    const addProvince = () => {
    if (!newName.trim()) return;
    fetch('/api/provinces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nameProvince: newName}) // idProvince se genera en el backend
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
    

    
    return (
        <div className="admin-home">
            <h1>Provinces Admin</h1>
            <ul>
                {provinces.map(prov => (
                    <li key={prov.idProvince}>
                        <ProvinceLabel name={prov.nameProvince} id={prov.idProvince} />
                    </li>
                ))}
            </ul>

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