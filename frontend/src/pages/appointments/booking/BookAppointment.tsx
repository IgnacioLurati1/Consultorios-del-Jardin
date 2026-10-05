import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { FaChevronDown, FaCircleInfo, FaLocationDot, FaMagnifyingGlass } from "react-icons/fa6";
import { AdminHeader } from "../../../components/adminHeader/AdminHeader.tsx";
import { SkeletonList } from "../../../components/skeleton/Skeleton.tsx";
import { Toasts } from "../../../components/toast/Toasts.tsx";
import { findAllActiveOffices } from "../../adminCRUDS/adminOffices/OfficeService.ts";
import { findPerson, getDecodedToken } from "../../commonServices";
import { findProfessionalsOfficeSpecialty } from "../../adminCRUDS/adminUsers/usersService.ts";
import { sameSpeciality, specialities as currentSpecialities, useSpecialities } from "../../specialities.ts";
import { bookingBlockedFor } from "../appointmentTypes.ts";
import type { Office, Person } from "../../types.ts";
import { currentWords, hasBranches, useInstallation, usePolicies, useWords } from "../../../lib/installation.ts";
import { branchFromOffice, branchName, manyCities } from "../../adminCRUDS/adminOffices/branches.ts";
import { AboutProfessionalModal } from "./AboutProfessionalModal.tsx";
import { ProfessionalSchedule } from "./ProfessionalSchedule.tsx";
import { SpecialitySchedule } from "./SpecialitySchedule.tsx";
import "./booking.css";

const normalize = (text: string) =>
  text
    ?.normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase() ?? "";

/** Una sola lista vacía para todos los dibujos: una nueva en cada uno haría recalcular el filtro. */
const NOBODY: Person[] = [];

/**
 * Pedido de turno del paciente, todo en una pantalla: se filtra por especialidad o por
 * nombre, se toca un profesional y sus horarios aparecen abajo. Cambiar de profesional
 * cambia solo esa parte, así comparar agendas no obliga a ir y volver.
 *
 * Con una especialidad elegida y sin profesional tocado, abajo van los horarios de todos
 * los de la lista juntos, cada uno con su nombre (SpecialitySchedule). Tocar un
 * profesional pasa a su agenda sola, que es la que tiene lista de espera.
 *
 * Con una sola sucursal no se pide: se resuelve sola. Donde se trabaja con varias (regla
 * multiBranch), se elige arriba de todo, y cada profesional dice en cuáles atiende.
 *
 * El profesional también entra acá: se atiende como cualquier otro paciente. Lo único que
 * no puede es elegirse a sí mismo, así que no aparece en su propia lista.
 */
export function BookAppointment() {
  const w = useWords();
  const policies = usePolicies();
  /** Si la instalación trabaja con varias sucursales. Apagado, la pantalla es la de siempre. */
  const multi = hasBranches(useInstallation());
  const specialities = useSpecialities();
  // De la sesión, no de un dato que venga de la pantalla: es lo que decide a quién se
  // saca de la lista.
  const me = getDecodedToken();
  const bookingForSelf = me?.type === "professional";
  /** Por qué no puede sacar turno, si es que no puede. Hoy solo le pasa al administrador. */
  const blockedReason = bookingBlockedFor(me?.type);
  /** Las sucursales activas. Con una sola sucursal, se usa la primera y nada más. */
  const [offices, setOffices] = useState<Office[]>([]);
  /** La sucursal elegida, por su número. */
  const [officeId, setOfficeId] = useState("");
  /** Los profesionales de cada sucursal pedida, por su número. */
  const [byOffice, setByOffice] = useState<Record<string, Person[]>>({});
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
    currentSpecialities().find((item) => sameSpeciality(item, asked)) ?? ""
  );
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Person | undefined>(undefined);

  const scheduleRef = useRef<HTMLDivElement | null>(null);

  /*
   * El aviso de la lista de espera trae al profesional en la dirección, para que el
   * horario que se liberó esté a un toque y no haya que buscarlo en la lista. Con varias
   * sucursales también puede venir cuál (?sucursal=), y si ese profesional no atiende en
   * la que quedó elegida se pasa a una donde sí.
   */
  const askedProfessional = params.get("profesional");
  const askedOffice = params.get("sucursal");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    findAllActiveOffices()
      .then(async (list) => {
        if (cancelled) return;

        // Se piden los profesionales de la sucursal, no todos: los que no tienen
        // horarios cargados no pueden dar turnos y solo ensucian el listado. Con varias
        // sucursales se piden los de cada una, y de ahí sale también en cuáles atiende
        // cada profesional, sin preguntarlo de a uno.
        const targets = multi && list.length > 1 ? list : list.slice(0, 1);
        const first = targets[0];

        if (!first) {
          setOffices([]);
          setByOffice({});
          setOfficeId("");
          return;
        }

        const results = await Promise.allSettled(
          targets.map((item) => findProfessionalsOfficeSpecialty(String(item.idOffice)))
        );
        if (cancelled) return;

        // Una sucursal que no contestó queda vacía y se avisa; las demás se muestran igual.
        const map: Record<string, Person[]> = {};
        const failures: Error[] = [];
        results.forEach((result, index) => {
          const id = String(targets[index].idOffice);
          map[id] = result.status === "fulfilled" ? result.value : [];
          if (result.status === "rejected") failures.push(result.reason as Error);
        });

        let initial = targets.find((item) => String(item.idOffice) === askedOffice) ?? first;
        if (askedProfessional) {
          const attends = (item: Office) =>
            (map[String(item.idOffice)] ?? []).some(
              (professional) => professional.email.toLowerCase() === askedProfessional.toLowerCase()
            );
          if (!attends(initial)) initial = targets.find(attends) ?? initial;
        }

        setOffices(targets);
        setByOffice(map);
        setOfficeId(String(initial.idOffice));
        if (failures[0]) toast.error(`Error al cargar ${currentWords().los("profesional")}: ${failures[0].message}`);
      })
      .catch((err) => toast.error(`Error al cargar ${currentWords().los("profesional")}: ${err.message}`))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [multi, askedOffice, askedProfessional]);

  const office = offices.find((item) => String(item.idOffice) === officeId);
  const professionals = byOffice[officeId] ?? NOBODY;
  /** Si se elige sucursal: la regla prendida y más de una con la que trabajar. */
  const choosing = offices.length > 1;
  /** Con sucursales en más de una ciudad, el nombre de cada una lleva la ciudad. */
  const withCity = useMemo(() => manyCities(offices.map(branchFromOffice)), [offices]);

  /** Las sucursales donde atiende un profesional. Vacía si no se elige sucursal. */
  function branchesOf(email: string): Office[] {
    if (!choosing) return [];
    return offices.filter((item) => (byOffice[String(item.idOffice)] ?? []).some((professional) => professional.email === email));
  }

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

  /*
   * El profesional que vino en la dirección (ver arriba) se elige una sola vez: si después
   * la persona toca otro, no se lo vuelve a poner. Mientras no aparezca en la lista se
   * sigue esperando: con varias sucursales, puede llegar recién con la que le corresponde.
   */
  const preselected = useRef(false);

  useEffect(() => {
    if (preselected.current || !askedProfessional || professionals.length === 0) return;

    const found = professionals.find((professional) => professional.email.toLowerCase() === askedProfessional.toLowerCase());
    if (!found) return;
    preselected.current = true;

    // No pasa por `pick`, que da vuelta la selección: acá siempre es abrir, nunca cerrar.
    setSelected(found);
    requestAnimationFrame(() => scheduleRef.current?.scrollIntoView({ behavior: "auto", block: "nearest" }));
  }, [professionals, askedProfessional]);

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

  // Donde los turnos se piden al consultorio, la pantalla lo dice y lleva al contacto. Se
  // llega igual desde un link viejo o desde un aviso guardado.
  if (!policies.patientBooking)
    return (
      <div className="adm-page">
        <AdminHeader title={`Solicitar ${w.turno}`} backTo="/" backLabel="Inicio" />
        <div className="adm-panel">
          <div className="adm-empty">
            <p>{`${w.Los("turno")} se piden directamente ${w.al("lugar")}.`}</p>
            <Link className="adm-btn adm-btn-primary" to="/contacto">
              Contacto
            </Link>
          </div>
        </div>
      </div>
    );

  return (
    <div className="adm-page">
      <AdminHeader
        title={`Solicitar ${w.turno}`}
        subtitle={bookingForSelf ? `${w.Turno} con un colega ${w.del("lugar")}` : `Por ${w.especialidad} o por ${w.profesional}`}
        backTo={bookingForSelf ? "/ProfessionalHome" : "/"}
        backLabel={bookingForSelf ? "Mi panel" : "Inicio"}
      />

      <Toasts />

      {bookingForSelf && (
        <p className="ui-alert ui-alert-info booking-self-note">{`${w.Turno} como ${w.paciente}. El perfil propio queda fuera de la lista.`}</p>
      )}

      {/* Dicho al entrar y no recién al final: recorrer agendas y elegir un horario para
          enterarse ahí de que no se podía es hacerle perder el rato. En la ventana de
          confirmar se repite, porque es donde se toca el botón que no está. */}
      {blockedReason && <p className="ui-alert ui-alert-warn booking-self-note">{blockedReason}</p>}

      <div className="adm-filters">
        {/* Primero dónde: la lista de abajo y los horarios son los de esa sucursal. */}
        {choosing && (
          <div className="adm-chips booking-branches" role="group" aria-label={w.Sucursal}>
            {offices.map((item) => {
              const id = String(item.idOffice);
              const active = id === officeId;

              return (
                <button key={id} type="button" className={active ? "active" : ""} aria-pressed={active} onClick={() => setOfficeId(id)}>
                  <FaLocationDot aria-hidden="true" />
                  {item.description}
                  {item.city?.nameCity && <span className="booking-branch-city">{item.city.nameCity}</span>}
                </button>
              );
            })}
          </div>
        )}

        <div className="adm-chips" role="group" aria-label={w.Especialidad}>
          <button type="button" className={speciality === "" ? "active" : ""} onClick={() => setSpeciality("")}>
            {`Tod${w.os("especialidad")}`}
          </button>
          {specialities.map((item) => (
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
            placeholder={`Buscar por nombre o apellido ${w.del("profesional")}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="adm-panel">
        {loading ? (
          <SkeletonList rows={4} />
        ) : !office ? (
          <div className="adm-empty">{`Sin ${w.sucursal} habilitad${w.o("sucursal")} para ${w.turnos}.`}</div>
        ) : professionals.length === 0 ? (
          <div className="adm-empty">{`Sin ${w.profesionales} con horarios de atención cargados.`}</div>
        ) : results.length === 0 ? (
          <div className="adm-empty">{`Sin ${w.profesionales} para esta búsqueda.`}</div>
        ) : (
          <ul className="booking-professionals">
            {results.map((professional) => {
              const active = selected?.email === professional.email;
              const initials = `${professional.surname?.charAt(0) ?? ""}${professional.name?.charAt(0) ?? ""}`.toUpperCase();
              const where = branchesOf(professional.email);

              return (
                <li key={professional.email} className={`booking-professional-row ${active ? "active" : ""}`}>
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
                      {where.length > 0 && (
                        <span className="booking-professional-branches">
                          <FaLocationDot aria-hidden="true" />
                          {where.map((item) => branchName(branchFromOffice(item), withCity)).join(" · ")}
                        </span>
                      )}
                    </span>

                    <span className="booking-professional-action">
                      {active ? "Ocultar horarios" : "Ver horarios"}
                      <FaChevronDown className={active ? "rotated" : ""} aria-hidden="true" />
                    </span>
                  </button>

                  {/* Hermano del botón de arriba y no hijo: un botón dentro de otro no es
                      HTML válido, y abrir la ficha no tiene por qué desplegar los horarios. */}
                  <button
                    type="button"
                    className="booking-about-btn"
                    onClick={() => setAbout(professional)}
                    title="Acerca de mí"
                    aria-label={`Acerca de ${professional.name} ${professional.surname}`}
                  >
                    <FaCircleInfo aria-hidden="true" />
                    <span>Acerca de mí</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div ref={scheduleRef}>
        {selected && office && (
          <ProfessionalSchedule professional={selected} office={office} blockedReason={blockedReason} />
        )}
        {/* Los de la lista y no todos los de la especialidad: si se escribió un nombre, la
            grilla muestra lo mismo que la lista de arriba. */}
        {!selected && office && speciality && results.length > 0 && (
          <SpecialitySchedule speciality={speciality} professionals={results} office={office} blockedReason={blockedReason} />
        )}
      </div>

      <AboutProfessionalModal
        open={!!about}
        onClose={() => setAbout(undefined)}
        professional={about}
        patient={profile}
        branches={about && choosing ? branchesOf(about.email) : undefined}
      />
    </div>
  );
}
