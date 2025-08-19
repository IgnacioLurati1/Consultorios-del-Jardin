import { useEffect, useState } from "react";
import "../../adminCRUDS/adminCRUDS.css";
import { NavZone } from "../../../components/navZone/NavZone.tsx";
import { FaSearch, FaPlus } from "react-icons/fa";
import { OfficeLabel } from "./OfficeLabel.tsx";
import { OfficeModal } from "./OfficeModal.tsx";

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
        console.log("Offices fetched:", data.data);
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
        setError({ baseMessage: "Error fetching offices: ", detail: error.message });
      });
  }, []);

  useEffect(() => {
    setFilteredOffices(
      offices.filter((office: Office) =>
        office.description
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
          )
      )
    );
  }, [searchTerm, offices]);

  useEffect(() => {
    if (error == null) return;
    setTimeout(() => {
      setError(null);
    }, 12000);
  }, [error]);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  useEffect(() => {
    fetch("/api/cities")
      .then((response) => response.json())
      .then((data) => {
        console.log("Cities fetched:", data.data);
        setCities(data.data);
      })
      .catch((error) => {
        setError({ baseMessage: "Error fetching cities: ", detail: error.message });
      });
  }, []);

  useEffect(() => {
    fetch("/api/provinces")
      .then((response) => response.json())
      .then((data) => {
        console.log("Provinces fetched:", data.data);
        setProvinces(data.data);
      })
      .catch((error) => {
        setError({ baseMessage: "Error fetching provinces: ", detail: error.message });
      });
  }, []);

  function addOffice(
    description: string,
    openingTime: string,
    closingTime: string,
    cityId: string
  ) {
    if (!description.trim() || !openingTime || !closingTime || !cityId) return;
    fetch("/api/offices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: description,
        openingTime,
        closingTime,
        active: true,
        cityId,
      }),
    })
      .then((res) => {
        if (!res.ok) {
          setModalVisible(false);
          throw new Error("Error creating office");
        }
        return res.json();
      })
      .then((created) => {
        console.log("Office created:", created);
        setModalVisible(false);
        setError(null);
        setOffices((prev) => [...prev, created]);
      })
      .catch((error) => {
        setError({
          baseMessage: "Error creating office: ",
          detail: error.message,
        });
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
      })
      .catch((error) => {
        setError({
          baseMessage: "Error deleting office: ",
          detail: error.message,
        });
      });
  }

  function editOffice(
    id: string,
    description: string,
    openingTime: string,
    closingTime: string,
    cityId: string
  ) {
    if (!id || !description.trim() || !openingTime || !closingTime || !cityId) return;
    fetch(`/api/offices/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: description, openingTime, closingTime, cityId }),
    })
      .then((res) => {
        if (res.ok) {
          return res.json();
        }
        setModalVisible(false);
        throw new Error("Office name is already in use");
      })
      .then((updated) => {
        const newOffices = [
          updated.data,
          ...offices.filter((office) => office.idOffice !== id),
        ];
        setOffices(newOffices);
        setError(null);
        setModalVisible(false);
      })
      .catch((error) => {
        setError({
          baseMessage: "Error updating office: ",
          detail: error.message,
        });
      });
  }

  return (
    <>
      <div className="admin-home">
        <NavZone title="Administrador de Oficinas" />
        <div className="crud-searchBar">
          <FaSearch className="search-icon" />
          <input
            className="crud-searchInput"
            type="text"
            placeholder="ingrese el nombre de la oficina"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="crud-grid">
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
                  provinces={office.city.province.nameProvince}
                  onDelete={() => deleteOffice(office.idOffice)}
                  onEdit={() => editOffice(
                    office.idOffice,
                    office.description,
                    office.openingTime,
                    office.closingTime,
                    office.city.idCity
                  )}
                  active={office.active}
                />
              </li>
            ))}
          </ul>
          <button
            className="crud-add-button"
            onClick={() => {
              setModalVisible(true);
              setModalAction("create");
            }}
          >
            <strong>Agregar Oficina </strong>
            <FaPlus />
          </button>

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

          {error != null && (
            <p className="crud-error-message">
              <strong>{error.baseMessage}</strong>
              {error.detail}
            </p>
          )}
        </div>
      </div>
    </>
  );
}