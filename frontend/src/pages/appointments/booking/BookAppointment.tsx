import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { FaChevronDown, FaCircleInfo, FaMagnifyingGlass } from "react-icons/fa6";
import { AdminHeader } from "../../../components/adminHeader/AdminHeader.tsx";
import { SkeletonList } from "../../../components/skeleton/Skeleton.tsx";
import { Toasts } from "../../../components/toast/Toasts.tsx";
import { findAllActiveOffices } from "../../adminCRUDS/adminOffices/OfficeService.ts";
import { findPerson, getDecodedToken } from "../../commonServices";
import { findProfessionalsOfficeSpecialty } from "../../adminCRUDS/adminUsers/usersService.ts";
import { SPECIALITIES, sameSpeciality } from "../../specialities.ts";
import type { Office, Person } from "../../types.ts";
import { AboutProfessionalModal } from "./AboutProfessionalModal.tsx";
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
 * No se pide la sucursal: hay una sola y se resuelve sola.
 *
 * El profesional también entra acá: se atiende como cualquier otro paciente. Lo único que
 * no puede es elegirse a sí mismo, así que no aparece en su propia lista.
 */
export function BookAppointment() {
  // De la sesión, no de un dato que venga de la pantalla: es lo que decide a quién se
  // saca de la lista.
  const me = getDecodedToken();
  const bookingForSelf = me?.type === "professional";
  const [office, setOffice] = useState<Office | undefined>(undefined);
  const [professionals, setProfessionals] = useState<Person[]>([]);
  /** El profesional cuya ficha se está mirando. Es independiente de a quién se le pide turno. */
  const [about, setAbout] = useState<Person | undefined>(undefined);
  // El token trae el email pero no el nombre, y el mensaje que se le manda al profesional
  // se firma con el nombre: de otra forma le llega un mail de una dirección y nada más.
  const [profile, setProfile] = useState<Person | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  // La portada linkea cada especialidad acá: si viene en la URL, el filtro arranca puesto.
  const [params] = useSearchParams();
  const asked = params.get("especialidad") ?? "";
  const [speciality, setSpeciality] = useState<string>(
    SPECIALITIES.find((item) => sameSpeciality(item, asked)) ?? ""
  );
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

        // Se piden los profesionales de la sucursal, no todos: los que no tienen
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
      // Un profesional no se da turno a sí mismo: se ocuparía su propio módulo y el
      // turno no existiría para nadie.
      if (bookingForSelf && professional.email === me?.email) return false;
      if (speciality && !sameSpeciality(professional.speciality ?? "", speciality)) return false;
      if (!term) return true;

      return (
        normalize(professional.name).includes(term) ||
        normalize(professional.surname).includes(term) ||
        normalize(professional.speciality ?? "").includes(term)
      );
    });
  }, [professionals, speciality, search, bookingForSelf, me?.email]);

  // Si el profesional elegido queda fuera del filtro, sus horarios ya no vienen al caso.
  useEffect(() => {
    if (selected && !results.some((professional) => professional.email === selected.email)) {
      setSelected(undefined);
    }
  }, [results, selected]);

  // Si falla, el modal se abre igual: el mensaje va sin nombre pero con el email, que es
  // lo que hace falta para que le contesten.
  useEffect(() => {
    if (!me?.email) return;
    findPerson(me.email).then(setProfile).catch(() => setProfile(undefined));
  }, [me?.email]);

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
        subtitle={
          bookingForSelf
            ? "Elegí con qué colega te querés atender"
            : "Elegí una especialidad o buscá a tu profesional"
        }
        backTo={bookingForSelf ? "/ProfessionalHome" : "/"}
        backLabel={bookingForSelf ? "Mi panel" : "Inicio"}
      />

      <Toasts />

      {bookingForSelf && (
        <p className="ui-alert ui-alert-info booking-self-note">
          Este turno es para vos como paciente. No figurás en la lista porque no podés
          atenderte a vos mismo.
        </p>
      )}

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
          <div className="adm-empty">Todavía no hay una sucursal habilitada para dar turnos.</div>
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

                  {/* Fuera del botón de arriba: un botón dentro de otro no es HTML válido,
                      y además abrir la ficha no tiene por qué desplegar los horarios. */}
                  <button
                    type="button"
                    className="booking-about-btn"
                    onClick={() => setAbout(professional)}
                    aria-label={`Acerca de ${professional.name} ${professional.surname}`}
                  >
                    <FaCircleInfo aria-hidden="true" />
                    Acerca de mí
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

      <AboutProfessionalModal open={!!about} onClose={() => setAbout(undefined)} professional={about} patient={profile} />
    </div>
  );
}
