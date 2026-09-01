import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { FaChevronDown, FaMagnifyingGlass } from "react-icons/fa6";
import { AdminHeader } from "../../../components/adminHeader/AdminHeader.tsx";
import { SkeletonList } from "../../../components/skeleton/Skeleton.tsx";
import { Toasts } from "../../../components/toast/Toasts.tsx";
import { findAllActiveOffices } from "../../adminCRUDS/adminOffices/OfficeService.ts";
import { findProfessionalsOfficeSpecialty } from "../../adminCRUDS/adminUsers/usersService.ts";
import { SPECIALITIES, sameSpeciality } from "../../specialities.ts";
import type { Office, Person } from "../../types.ts";
import { ProfessionalSchedule } from "./ProfessionalSchedule.tsx";
import "./booking.css";

const normalize = (text: string) =>
  text
    ?.normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase() ?? "";

/**
 * Pedido de turno del paciente, todo en una pantalla: se filtra por especialidad o por
 * nombre, se toca un profesional y sus horarios aparecen abajo. Cambiar de profesional
 * cambia solo esa parte, así comparar agendas no obliga a ir y volver.
 *
 * No se pide el consultorio: hay uno solo y se resuelve solo.
 */
export function BookAppointment() {
  const [office, setOffice] = useState<Office | undefined>(undefined);
  const [professionals, setProfessionals] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  const [speciality, setSpeciality] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Person | undefined>(undefined);

  const scheduleRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    findAllActiveOffices()
      .then(async (offices) => {
        if (cancelled) return;

        const only = offices[0];
        setOffice(only);

        if (!only) {
          setProfessionals([]);
          return;
        }

        // Se piden los profesionales del consultorio, no todos: los que no tienen
        // horarios cargados no pueden dar turnos y solo ensucian el listado.
        const data = await findProfessionalsOfficeSpecialty(String(only.idOffice));
        if (!cancelled) setProfessionals(data);
      })
      .catch((err) => toast.error(`No pudimos cargar los profesionales: ${err.message}`))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const results = useMemo(() => {
    const term = normalize(search.trim());

    return professionals.filter((professional) => {
      if (speciality && !sameSpeciality(professional.speciality ?? "", speciality)) return false;
      if (!term) return true;

      return (
        normalize(professional.name).includes(term) ||
        normalize(professional.surname).includes(term) ||
        normalize(professional.speciality ?? "").includes(term)
      );
    });
  }, [professionals, speciality, search]);

  // Si el profesional elegido queda fuera del filtro, sus horarios ya no vienen al caso.
  useEffect(() => {
    if (selected && !results.some((professional) => professional.email === selected.email)) {
      setSelected(undefined);
    }
  }, [results, selected]);

  function pick(professional: Person) {
    if (selected?.email === professional.email) {
      setSelected(undefined);
      return;
    }

    setSelected(professional);

    // Con la lista larga, los horarios pueden quedar fuera de pantalla.
    requestAnimationFrame(() => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      scheduleRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
    });
  }

  return (
    <div className="adm-page">
      <AdminHeader
        title="Pedir un turno"
        subtitle="Elegí una especialidad o buscá a tu profesional"
        backTo="/"
        backLabel="Inicio"
      />

      <Toasts />

      <div className="adm-filters">
        <div className="adm-chips" role="group" aria-label="Especialidad">
          <button type="button" className={speciality === "" ? "active" : ""} onClick={() => setSpeciality("")}>
            Todas
          </button>
          {SPECIALITIES.map((item) => (
            <button
              key={item}
              type="button"
              className={speciality === item ? "active" : ""}
              onClick={() => setSpeciality(speciality === item ? "" : item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="booking-search">
          <FaMagnifyingGlass className="booking-search-icon" />
          <input
            type="search"
            placeholder="Buscar por nombre o apellido del profesional"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="adm-panel">
        {loading ? (
          <SkeletonList rows={4} />
        ) : !office ? (
          <div className="adm-empty">Todavía no hay un consultorio habilitado para dar turnos.</div>
        ) : professionals.length === 0 ? (
          <div className="adm-empty">Todavía no hay profesionales con horarios de atención cargados.</div>
        ) : results.length === 0 ? (
          <div className="adm-empty">
            Ningún profesional coincide con la búsqueda.
            <br />
            Probá con otra especialidad o borrá el texto.
          </div>
        ) : (
          <ul className="booking-professionals">
            {results.map((professional) => {
              const active = selected?.email === professional.email;
              const initials = `${professional.surname?.charAt(0) ?? ""}${professional.name?.charAt(0) ?? ""}`.toUpperCase();

              return (
                <li key={professional.email}>
                  <button
                    type="button"
                    className={`booking-professional ${active ? "active" : ""}`}
                    aria-expanded={active}
                    onClick={() => pick(professional)}
                  >
                    <span className="booking-professional-avatar" aria-hidden="true">
                      {initials}
                    </span>

                    <span className="booking-professional-text">
                      <span className="booking-professional-name">
                        {professional.surname}, {professional.name}
                      </span>
                      <span className="booking-professional-speciality">{professional.speciality}</span>
                    </span>

                    <span className="booking-professional-action">
                      {active ? "Ocultar horarios" : "Ver horarios"}
                      <FaChevronDown className={active ? "rotated" : ""} aria-hidden="true" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div ref={scheduleRef}>
        {selected && office && <ProfessionalSchedule professional={selected} office={office} />}
      </div>
    </div>
  );
}
