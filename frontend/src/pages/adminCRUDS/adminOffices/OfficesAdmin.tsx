import { useEffect, useState } from "react";
import "../../adminHome/AdminHome.css";
import { NavZone } from "../../../components/navZone/NavZone.tsx";
import { FaSearch } from "react-icons/fa";
import { FaPlus } from "react-icons/fa";
import { OfficeLabel } from "./officeLabel";
import { OfficeModal } from "./officeModal";

export function OfficeAdmin() {
  interface Province {
    idProvince: string;
    nameProvince: string;
  }

  interface City {
    idCity: string;
    nameCity: string;
    province: Province;
  }

  interface Office {
    idOffice: string;
    openingTime: string;
    closingTime: string;
    description: string;
    active: boolean;
    city: City;
  }

  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [filteredOffices, setFilteredOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editData, setEditData] = useState<Office | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalAction, setModalAction] = useState<'create' | 'edit'>('create');
  const [selectedOffice, setSelectedOffice] = useState<Office | null>(null);
  
  const fetchAll = async () => {
      try {
        const [provRes, cityRes, offRes] = await Promise.all([
          fetch("/api/provinces"),
          fetch("/api/cities"),
          fetch("/api/offices")
        ]);

        const provData = await provRes.json();
        const cityData = await cityRes.json();
        const offData = await offRes.json();

        const provincesArray: Province[] = provData.data.filter((p: any) => p.active);
        const citiesArray: City[] = cityData.data.filter((cities: any) => cities.active);

        const enrichedOffices: Office[] = offData.data
        .map((office: any) => {
          const city = citiesArray.find(c => c.idCity === office.city);
          if (!city) return null;

          const province = provincesArray.find(p => p.idProvince === city.province.idProvince);
          if (!province) return null;

          return {
            ...office,
            city: {
              ...city,
              province: {
                ...province
              }
            }
          };
        })
        .filter((office: Office | null): office is Office => office !== null);

        setProvinces(provincesArray);
        setCities(citiesArray);
        setOffices(enrichedOffices);
        setFilteredOffices(enrichedOffices
          .sort((a, b) => {
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
      } catch (err: any) {
        setError(err.message || "Error al cargar datos");
        setLoading(false);
      }
    };

useEffect(() => {
  fetchAll();
}, []);

  useEffect(() => {
    setFilteredOffices(
      offices.filter((office: Office) =>
        office.description.normalize("NFD").replace(/\p{Diacritic}/gu, '')
          .replace(/\s+/g, '').toLowerCase()
          .includes(searchTerm.normalize("NFD").replace(/\p{Diacritic}/gu, '')
            .replace(/\s+/g, '').toLowerCase())
      )
    );
  }, [searchTerm, offices]);

  const deleteOffice = async (id: string) => {
    try {
      const res = await fetch(`/api/offices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || res.statusText);
      }

      setOffices(offices.map(o => o.idOffice === id ? { ...o, active: false } : o));
      setFilteredOffices(filteredOffices.map(o => o.idOffice === id ? { ...o, active: false } : o));
      //await fetchAll();
      setModalVisible(false);
      setSelectedOffice(null);
    } catch (err: any) {
      alert('Error al dar de baja el consultorio: ' + err.message);
    }
  };

const addOffice = async (newOffice: { openingTime: string; closingTime: string; description: string; city: string; active: boolean }) => {
  try {
    const res = await fetch("/api/offices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newOffice),
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || res.statusText);
    }
    const response = await res.json();
    const cityObj = cities.find(c => c.idCity === newOffice.city);
    const provinceObj = cityObj ? provinces.find(p => p.idProvince === cityObj.province.idProvince) : undefined;
    const enrichedOffice = {
      ...response.data,
      city: cityObj ? { ...cityObj, province: provinceObj } : undefined
    };
    setOffices([...offices, enrichedOffice]);
    setFilteredOffices([...offices, enrichedOffice]);
    await fetchAll();
    setModalVisible(false);
  } catch (err: any) {
    alert('Error al crear el consultorio: ' + err.message);
  }
};

const editOffice = async (updatedOffice: { 
  idOffice: string; 
  openingTime: string; 
  closingTime: string; 
  description: string; 
  cityId: string; 
  active: boolean 
}) => {
  if (!updatedOffice.cityId) {
    alert("Debe seleccionar una ciudad");
    return;
  }

  try {
    const res = await fetch(`/api/offices/${updatedOffice.idOffice}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedOffice),
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || res.statusText);
    }
    const response = await res.json();
    const cityObj = cities.find(c => c.idCity === updatedOffice.cityId);
    const provinceObj = cityObj ? provinces.find(p => p.idProvince === cityObj.province.idProvince) : undefined;
    const enrichedOffice = {
      ...response.data,
      city: cityObj ? { ...cityObj, province: provinceObj } : undefined
    };
    setOffices(offices.map(o => o.idOffice === enrichedOffice.idOffice ? enrichedOffice : o));
    setFilteredOffices(offices.map(o => o.idOffice === enrichedOffice.idOffice ? enrichedOffice : o));
    //await fetchAll();
    setModalVisible(false);
    setEditData(null);
  } catch (err: any) {
    alert('Error al editar el consultorio: ' + err.message);
  }
};

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <>
    <div className="admin-home">
      <NavZone title="Administrador de Consultorios" />
      <div className="crud-searchBar">
      <FaSearch className="search-icon" />
          <input className="crud-searchInput"
            type="text"
            placeholder="Ingrese la descripción del consultorio"
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="crud-grid">
          <ul className="crud-list">
            {filteredOffices.map(office => (
              <li key={office.idOffice}
                onClick={() => { 
                  setModalVisible(true);
                  setModalAction('edit'); 
                  setSelectedOffice(office); }}>
                <OfficeLabel office={office} />
              </li>
            ))}
          </ul>
        </div>
          <button className="crud-add-button" onClick={() => (setModalVisible(true), setModalAction('create'))}><strong>Agregar Consultorio </strong><FaPlus /></button>
          
        {selectedOffice !== null && modalAction === "edit" && (
            <OfficeModal
                visible={modalVisible}
                office={selectedOffice}
                provinces={provinces}
                cities={cities}
                onClose={() => setModalVisible(false)}
                onDelete={() => deleteOffice(selectedOffice.idOffice)}
                onEdit={(idOffice, description, openingTime, closingTime, cityId) =>
                    editOffice({ idOffice, description, openingTime, closingTime, cityId, active: true })
                }
                onCreate={(description, openingTime, closingTime, cityId) =>
                    addOffice({ description, openingTime, closingTime, city: cityId, active: true })
                }
                action="edit"
            />
        )}
          {modalAction === "create" && (
            <OfficeModal
              visible={modalVisible}
              office={null}
              onClose={() => setModalVisible(false)}
              onDelete={() => {}}
              onEdit={() => {}}
              onCreate={(description, openingTime, closingTime, cityId) =>
                addOffice({ description, openingTime, closingTime, city: cityId, active: true })
              }
              provinces={provinces}
              cities={cities}
              action="create"
            />
          )}
            {error != null && (
                <p className="crud-error-message"><strong>{error}</strong></p>
            )}
            
        </div>
    </>
  );
}