import { useEffect, useState } from "react";
import { OfficeLabel } from "./officeLabel.tsx";
import { OfficeModal } from "./officeModal.tsx";
import "../../adminHome/AdminHome.css";

export function OfficesAdmin() {
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
    const [modalType, setModalType] = useState("");


    useEffect(() => {
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

                setProvinces(provData.data);
                setCities(cityData.data);
                setOffices(offData.data);
                setFilteredOffices(offData.data);
                setLoading(false);
            } catch (err: any) {
                setError(err.message || "Error al cargar datos");
                setLoading(false);
            }
        };

        fetchAll();
    }, []);

    // Filtrado por búsqueda
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

    // BAJA LÓGICA
    const deleteOffice = async (id: string) => {
        const officeToUpdate = offices.find(o => o.idOffice === id);
        if (!officeToUpdate) return;

        const updatedOffice = { ...officeToUpdate, active: false };

        try {
            const res = await fetch(`/api/offices/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedOffice)
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || res.statusText);
            }
            const data = await res.json();
            setOffices(offices.map(o => o.idOffice === id ? data.data : o));
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
            setOffices([...offices, response.data]);
            setFilteredOffices([...offices, response.data]);
            setModalVisible(false);
        } catch (err: any) {
            alert('Error al crear el consultorio: ' + err.message);
        }
    };

    const editOffice = async (updatedOffice: { idOffice: string; openingTime: string; closingTime: string; description: string; city: string; active: boolean }) => {
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
            const updatedOfficeFromBackend = response.data;
            setOffices(offices.map(o => o.idOffice === updatedOfficeFromBackend.idOffice ? updatedOfficeFromBackend : o));
            setFilteredOffices(offices.map(o => o.idOffice === updatedOfficeFromBackend.idOffice ? updatedOfficeFromBackend : o));
            setModalVisible(false);
            setEditData(null);
        } catch (err: any) {
            alert('Error al editar el consultorio: ' + err.message);
        }
    };

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;

    return (
        <div className="admin-home">
            <h1>Administrador de Consultorios</h1>
            <div className="office-searchBar">
                <input
                    className="office-searchInput"
                    type="text"
                    placeholder="Ingrese la descripción del consultorio"
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="office-grid">
                <ul className="offices-list">
                    {filteredOffices.map(office => (
                        <li key={office.idOffice}
                            onClick={() => { setModalVisible(true); setEditData(office); setModalType("edit"); }}>
                            <OfficeLabel key={office.idOffice} office={office} />
                        </li>
                    ))}
                </ul>
            </div>
            <div>
                <button className="createOffice" onClick={() => { setModalVisible(true); setEditData(null); setModalType("create"); }}>Agregar Consultorio</button>
            </div>
            <OfficeModal
                visible={modalVisible}
                office={editData}
                cities={cities}
                provinces={provinces}
                onClose={() => setModalVisible(false)}
                onDelete={deleteOffice}
                onEdit={editOffice}
                onCreate={addOffice}
                type={modalType}
            />
        </div>
    );
}
