import { useEffect, useState } from "react";
import "../../adminCRUDS/adminCRUDS.css";
import { NavZone } from "../../../components/navZone/NavZone.tsx";
import { FaPlus } from "react-icons/fa";
import { OfficeLabel } from "./OfficeLabel.tsx";
import { OfficeModal } from "./OfficeModal.tsx";
import { toast, ToastContainer } from "react-toastify";
import type {Office, Province, City} from "../../types.ts";
import SearchBar from "../../../components/searchBar/searchBar.tsx";


export function OfficesAdmin() {

  const [offices, setOffices] = useState<Office[]>([]);
  const [filteredOffices, setFilteredOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedOffice, setSelectedOffice] = useState<Office | null>(null);
  const [modalAction, setModalAction] = useState<"create" | "edit">("create");
  const [cities, setCities] = useState<City[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);

  useEffect(() => {
    fetch("/api/offices")
      .then((response) => response.json())
      .then((data) => {
        setLoading(false);
        setOffices(data.data);
        setFilteredOffices(
          data.data.sort(
            (a: Office, b: Office) => Number(b.active) - Number(a.active)
          )
        );
      })
      .catch((error) => {
        setLoading(false);
        toast.error("Error cargando consultorios " + error);
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
    if (error == null) return;
    setTimeout(() => {
      setError(null);
    }, 12000);
  }, [error]);

  useEffect(() => {
    fetch("/api/cities")
      .then((response) => response.json())
      .then((data) => {
        setCities(data.data);
      })
      .catch((error) => {
        toast.error("Error cargando ciudades: " + error);
      });
  }, []);

  useEffect(() => {
    fetch("/api/provinces")
      .then((response) => response.json())
      .then((data) => {
        setProvinces(data.data);
      })
      .catch((error) => {
        toast.error("Error cargando provincias: " + error);
      });
  }, []);

useEffect(() => {
  if (offices.length > 0 && cities.length > 0) {
    setOffices((prev) =>
      prev.map((office) => {
        const fullCity = cities.find(
          (c) =>
            c.idCity ===
            (typeof office.city === "string"
              ? office.city
              : office.city.idCity)
        );
        return fullCity ? { ...office, city: fullCity } : office;
      })
    );
  }
}, [cities]);


  function addOffice(
  description: string,
  openingTime: string,
  closingTime: string,
  cityId: string
) {
  if (!description || !openingTime || !closingTime || !cityId) return; 
  fetch("/api/offices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      description,
      openingTime,
      closingTime,
      active: true,
      city: cityId,
    }),
  })
    .then((res) => {
      if (!res.ok) {
        setModalVisible(false);
        throw new Error(res.statusText);
      }
      return res.json();
    })
    .then((created) => {
      toast.success("Oficina creada exitosamente");
      const fullCity = cities.find(city => city.idCity === created.city || city.idCity === cityId);     
      if (fullCity) {
        const completeOffice = {
          ...created,
          city: fullCity
          
        };   
        setModalVisible(false);
        setError(null);
        setOffices((prev) => [...prev, completeOffice]);
      } else {
        fetch("/api/offices")
          .then((response) => response.json())
          .then((data) => {
            setOffices(data.data);
            setModalVisible(false);
          });
      }
    })
    .catch((error) => {
      setLoading(false);
      toast.error("La hora de apertura debe ser mayor a la hora de cierre");
      return error
    });
}


  function deleteOffice(id: string) {
    if (!id) return;

    fetch(`/api/offices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    })
      .then(() => {
        setOffices((prev) =>        
          prev.map((office) =>
            office.idOffice !== id ? office : { ...office, active: false }
          )
        );
        setError(null);
        setModalVisible(false);
        toast.success("Oficina eliminada exitosamente");
      })
      .catch((error) => {
        toast.error("Ocurrió un error al eliminar el consultorio: " + error);
      });
  }

  
function editOffice(
  id: string,
  description: string,
  openingTime: string,
  closingTime: string,
  cityId: string,
  active: boolean,
) {
  if (!id || !description || !openingTime || !closingTime || !cityId) return;
  
  if (active) {
    fetch(`/api/offices/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({description, openingTime, closingTime, city: cityId }),
    })
      .then((res) => {
        if (res.ok) {
          return res.json();
        }
        setModalVisible(false);
        throw new Error(error);
      })
      .then((updated) => {
        const fullCity = cities.find(city => city.idCity === cityId);
        
        let completeOffice;
        if (fullCity) {
          completeOffice = {
            ...updated.data,
            city: fullCity
          };
        } else {
          completeOffice = updated.data;
        }
        
        const newOffices = [
          completeOffice,
          ...offices.filter((office) => office.idOffice !== id),
        ];
        setOffices(newOffices);
        setError(null);
        setModalVisible(false);
        toast.success("Oficina modificada exitosamente");
      })
      .catch((error) => {
        toast.error("La hora de cierre debe ser mayor a la hora de apertura");
        return error
      });
  } else {
    fetch(`/api/offices/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    })
    .then((res) => {
      if (res.ok) {
        return res.json();
      }
      setModalVisible(false);
      throw new Error("Ocurrió un error al activar el consultorio");
    })
    .then((updated) => {
      const originalOffice = offices.find(office => office.idOffice === id);
      const completeOffice = {
        ...updated.data,
        city: originalOffice?.city || updated.data.city
      };
      
      const newOffices = [
        completeOffice,
        ...offices.filter((office) => office.idOffice !== id),
      ];
      setOffices(newOffices);
      setError(null);
      setModalVisible(false);
    })
    .catch((error) => {
      toast.error("Ocurrió un error al activar el consultorio:  consultorio: " + error);
    });
  }
}

  return (
    <>
      <div className="admin-home">
        <NavZone title="Administrador de Consultorios" />
        <ToastContainer 
                className = {`toast-container`}
                draggable={false}
            />
            <SearchBar searchHook={setSearchTerm} placeHolderText="Ingrese la descripción de un consultorio" />
            <div className={!loading ? "crud-grid" : "crud-grid skeleton-loading"}>
          <ul className="crud-list">
            {filteredOffices.map((office) => (
              <li
                key={office.idOffice}
                onClick={() => {
                  setModalVisible(true);
                  setModalAction("edit");
                  setSelectedOffice(office);
                }}
              >
                <OfficeLabel
                  description={office.description}
                  id={office.idOffice}
                  openingTime={office.openingTime} 
                  closingTime={office.closingTime}
                  city={office.city.nameCity}
                  onDelete={() => deleteOffice(office.idOffice)}
                  onEdit={() => editOffice(
                    office.idOffice,
                    office.description,
                    office.openingTime,
                    office.closingTime,
                    office.city.idCity,
                    office.active
                  )}
                  active={office.active}
                />
              </li>
            ))}
          </ul>

             {selectedOffice !== null && modalAction === "edit" && (
              <OfficeModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                office={selectedOffice}
                onDelete={() => deleteOffice(selectedOffice.idOffice)}
                onEdit={editOffice}
                action={modalAction}
                cities={cities}
                provinces={provinces}
                onCreate={() => {}}
              />
            )}
           
            {modalAction === "create" && (
              <OfficeModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                office={null}
                onDelete={() => {}}
                onEdit={() => {}}
                action={modalAction}
                onCreate={addOffice}
                cities={cities}
                provinces={provinces}
              />
            )}

        </div>
                  <div><button
            className="crud-add-button"
            onClick={() => {
              setModalVisible(true);
              setModalAction("create");
            }}
          >
            <strong>Agregar Consultorio </strong>
            <FaPlus />
          </button>
      </div></div>
    </>
  );
}