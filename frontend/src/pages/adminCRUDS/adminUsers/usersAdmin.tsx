import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FaPlus } from "react-icons/fa6";
import { AdminHeader } from "../../../components/adminHeader/AdminHeader.tsx";
import { SkeletonList } from "../../../components/skeleton/Skeleton.tsx";
import { Toasts } from "../../../components/toast/Toasts.tsx";
import { PeopleList, PeopleSearch, PersonRow, type PersonBadge } from "../../../components/peopleList/PeopleList.tsx";
import { getAllUsers, toggleBookable, toggleState, updatePerson } from "./usersService";
import { UserModal } from "./userModal";
import type { Person } from "../../types";

/** Los tres tipos de fila que puede haber en el listado. */
type UserFilter = "all" | "client" | "anonymous" | "professional";

const FILTERS: { key: UserFilter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "client", label: "Pacientes" },
  { key: "anonymous", label: "Anónimos" },
  { key: "professional", label: "Profesionales" },
];

/** Un paciente anónimo es un paciente, pero se cuenta y se filtra aparte. */
function matchesFilter(user: Person, filter: UserFilter): boolean {
  switch (filter) {
    case "client":
      return user.type === "client" && !user.anonymous;
    case "anonymous":
      return !!user.anonymous;
    case "professional":
      return user.type === "professional";
    default:
      return true;
  }
}

const normalize = (text: string) =>
  text
    ?.normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase() ?? "";

export function UsersAdmin() {
  const [users, setUsers] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [modalData, setModalData] = useState<Person>();
  const [modalVisible, setModalVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getAllUsers()
      .then(setUsers)
      .catch((err) => toast.error(`No pudimos cargar los usuarios: ${err.message}`))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = normalize(search.trim());

    return users.filter((user) => {
      if (!matchesFilter(user, filter)) return false;
      if (!term) return true;

      return (
        normalize(user.name).includes(term) ||
        normalize(user.surname).includes(term) ||
        normalize(user.email).includes(term)
      );
    });
  }, [search, filter, users]);

  // El número de cada chip no mira la búsqueda: es cuántos hay en total de ese tipo.
  const counts = useMemo(() => {
    const result = {} as Record<UserFilter, number>;
    for (const { key } of FILTERS) result[key] = users.filter((user) => matchesFilter(user, key)).length;
    return result;
  }, [users]);

  // Los pacientes anónimos guardan el email del profesional que los cargó. Como el
  // listado ya trae a todos los no-admin, el nombre se resuelve acá sin pedir nada más.
  const nameByEmail = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of users) map.set(user.email, `${user.surname}, ${user.name}`);
    return map;
  }, [users]);

  function describeOrigin(user: Person): string | null {
    if (!user.createdBy) return null;
    const author = nameByEmail.get(user.createdBy) ?? user.createdBy;
    return user.anonymous ? `cargado por ${author}` : `originalmente cargado por ${author}`;
  }

  function toggleStateUser(email: string) {
    toggleState(email)
      .then(() => {
        toast.success("Estado del usuario cambiado");
        setUsers((prev) => prev.map((user) => (user.email !== email ? user : { ...user, active: !user.active })));
      })
      .catch((err) => toast.error(`No pudimos cambiar el estado: ${err.message}`));
  }

  /** Esconderlo de la búsqueda de turnos no lo deshabilita: sigue trabajando igual. */
  function toggleBookableUser(email: string) {
    toggleBookable(email)
      .then(({ bookable }) => {
        toast.success(bookable ? "Vuelve a aparecer cuando se busca turno" : "Deja de aparecer cuando se busca turno");
        setUsers((prev) => prev.map((user) => (user.email !== email ? user : { ...user, bookable })));
      })
      .catch((err) => toast.error(`No pudimos cambiarlo: ${err.message}`));
  }

  // Solo se editan profesionales, y nunca la contraseña (ver UserModal).
  async function editUser(email: string, data: Partial<Person>) {
    try {
      const updated = await updatePerson(email, data);
      setUsers((prev) => prev.map((user) => (user.email !== email ? user : { ...user, ...updated })));
      toast.success("Profesional actualizado");
      setModalVisible(false);
    } catch (err: any) {
      toast.error(`No pudimos guardar los cambios: ${err.message}`);
    }
  }

  function badgesFor(user: Person): PersonBadge[] {
    const badges: PersonBadge[] = [
      user.type === "professional" ? { label: "Profesional", tone: "green" } : { label: "Paciente", tone: "grey" },
    ];

    if (user.anonymous) badges.push({ label: "Anónimo", tone: "amber" });
    if (!user.active) badges.push({ label: "Deshabilitado", tone: "red" });
    else if (user.type === "professional" && user.bookable === false) badges.push({ label: "Fuera de la búsqueda", tone: "amber" });

    return badges;
  }

  return (
    <div className="adm-page">
      <AdminHeader
        title="Usuarios"
        subtitle="Pacientes y profesionales registrados"
        actions={
          <button type="button" className="adm-btn adm-btn-primary" onClick={() => navigate("/AdminHome/RegisterProfAdmin")}>
            <FaPlus />
            Registrar profesional
          </button>
        }
      />

      <Toasts />

      <div className="adm-filters">
        <div className="adm-chips" role="group" aria-label="Tipo de usuario">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={filter === key ? "active" : ""}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {label}
              <span className="adm-chip-count">{counts[key]}</span>
            </button>
          ))}
        </div>

        <PeopleSearch value={search} onChange={setSearch} placeholder="Buscar por nombre, apellido o email" />
      </div>

      <div className="adm-panel">
        {loading ? (
          <SkeletonList rows={7} />
        ) : users.length === 0 ? (
          <div className="adm-empty">No hay usuarios cargados.</div>
        ) : filtered.length === 0 ? (
          <div className="adm-empty">
            {search.trim() ? "Ningún usuario coincide con la búsqueda." : "No hay usuarios de ese tipo."}
          </div>
        ) : (
          <PeopleList>
            {filtered.map((user) => {
              const origin = describeOrigin(user);

              return (
                <PersonRow
                  key={user.email}
                  name={user.name}
                  surname={user.surname}
                  meta={origin ? `${user.email} · ${origin}` : user.email}
                  tone={user.anonymous ? "amber" : user.type === "professional" ? "green" : "grey"}
                  badges={badgesFor(user)}
                  onClick={() => {
                    setModalData(user);
                    setModalVisible(true);
                  }}
                />
              );
            })}
          </PeopleList>
        )}
      </div>

      <UserModal
        visible={modalVisible}
        user={modalData}
        createdByName={modalData?.createdBy ? nameByEmail.get(modalData.createdBy) ?? modalData.createdBy : undefined}
        onClose={() => setModalVisible(false)}
        onToggleState={toggleStateUser}
        onToggleBookable={toggleBookableUser}
        onEdit={editUser}
      />
    </div>
  );
}
