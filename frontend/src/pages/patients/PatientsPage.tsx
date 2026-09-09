import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { FaAddressBook, FaMoneyBillWave, FaPlus } from "react-icons/fa6";
import { AdminHeader } from "../../components/adminHeader/AdminHeader.tsx";
import { SkeletonList } from "../../components/skeleton/Skeleton.tsx";
import { Toasts } from "../../components/toast/Toasts.tsx";
import { PeopleList, PeopleSearch, PersonRow } from "../../components/peopleList/PeopleList.tsx";
import { findAllPatients, findMyPatients, deleteAnonymousPatient, updatePatient } from "./patientsService.ts";
import { useUndo } from "../../context/UndoContext.tsx";
import { AppointmentDetailModal } from "../appointments/appointmentsList/AppointmentDetailModal.tsx";
import { useAppointmentActions } from "../appointments/useAppointmentActions.ts";
import { ContactPatientModal } from "./ContactPatientModal.tsx";
import { PatientDetailModal } from "./PatientDetailModal.tsx";
import { findPerson, getDecodedToken } from "../commonServices.ts";
import type { Person } from "../types.ts";
import { useSimpleText } from "../../lib/textMode.ts";

const normalize = (text: string) =>
  text
    ?.normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase() ?? "";

/**
 * De quien es la lista. Arranca en los propios: es lo que el profesional busca casi
 * siempre. Los del consultorio entero quedan a un click, para cuando hay que darle turno
 * a alguien que todavia no atendio.
 */
type Scope = "mine" | "all";

export function PatientsPage() {
  const [simple] = useSimpleText();
  const [patients, setPatients] = useState<Person[]>([]);
  // Quién está logueado: firma el borrador del mail que se le abre al paciente.
  const [me, setMe] = useState<Person | undefined>(undefined);
  const [contacting, setContacting] = useState<Person | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // Filtrar por deuda. Vive aparte del alcance porque es un recorte de lo que ya se
  // está mirando, y no otra lista.
  const [onlyDebtors, setOnlyDebtors] = useState(false);
  const [scope, setScope] = useState<Scope>("mine");

  // Una sola ventana sirve para el alta y para la corrección: `editing` guarda a quién
  // se está editando, y en null significa que se está creando uno nuevo.
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const { remember } = useUndo();

  useEffect(() => {
    const decoded = getDecodedToken();
    if (!decoded) return;

    findPerson(decoded.email)
      .then((data) => setMe(data ?? undefined))
      .catch(() => setMe(undefined));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (scope === "mine" ? findMyPatients() : findAllPatients())
      .then((data) => {
        if (!cancelled) setPatients(data);
      })
      .catch((err) => {
        if (!cancelled) toast.error(`No pudimos cargar los pacientes: ${err.message}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [scope]);

  // Cuántos le quedaron debiendo algo. Solo tiene sentido en los propios: la deuda es
  // con este profesional, y el listado de todos ni siquiera la trae.
  const debtors = useMemo(() => patients.filter((patient) => patient.owesPayment).length, [patients]);

  const filtered = useMemo(() => {
    const term = normalize(search.trim());

    return patients.filter((patient) => {
      if (onlyDebtors && !patient.owesPayment) return false;
      if (!term) return true;

      return (
        normalize(patient.name).includes(term) ||
        normalize(patient.surname).includes(term) ||
        normalize(patient.email).includes(term)
      );
    });
  }, [search, patients, onlyDebtors]);

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  /*
   * El atajo de teclado para dar de alta un paciente termina acá.
   *
   * Llega por la dirección porque se aprieta desde cualquier pantalla, y el parámetro se
   * borra apenas se usa: si quedara pegado, recargar o volver con el botón de atrás
   * abriría la ventana de nuevo sin que nadie la haya pedido.
   */
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (!searchParams.has("nuevo")) return;
    setEditing(null);
    setModalOpen(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  /*
   * Se llega desde la tarjeta de "Te quedaron debiendo" de Números, con el filtro puesto.
   *
   * El número de allá dice cuánto, y la pregunta que sigue es siempre quién. Llegar a esta
   * lista entera y tener que acordarse de prender el filtro es el paso que sobra.
   *
   * El parámetro se borra apenas se usa, igual que el del alta: es una orden y no un
   * estado de la pantalla. Si quedara pegado, apagar el filtro a mano y recargar lo
   * volvería a prender.
   */
  useEffect(() => {
    if (!searchParams.has("adeudan")) return;
    setScope("mine");
    setOnlyDebtors(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  /**
   * Cuántas veces hubo que volver a pedir el historial de la ficha abierta.
   *
   * Tocando un turno del historial se abre su ficha, y lo que se cambie ahí adentro tiene
   * que verse al cerrarla, sin tener que salir de la ficha del paciente y volver a entrar.
   */
  const [historyToken, setHistoryToken] = useState(0);

  /*
   * Todo lo que se puede hacer con un turno, para la ficha que se abre desde el historial.
   *
   * Es el mismo hook que usan la lista de turnos y la agenda del día, así que un turno
   * abierto desde acá hace exactamente lo mismo que abierto desde allá.
   */
  const turno = useAppointmentActions(me, () => setHistoryToken((veces) => veces + 1));

  return (
    <div className="adm-page">
      <AdminHeader
        title="Pacientes"
        subtitle={
          scope === "mine"
            ? "Las personas a las que les diste turno alguna vez"
            : "Todos los pacientes del consultorio, con cuenta y anónimos"
        }
        backTo="/ProfessionalHome"
        actions={
          <button type="button" className="adm-btn adm-btn-primary" onClick={openNew}>
            <FaPlus />
            Nuevo paciente anónimo
          </button>
        }
      />

      <Toasts />

      {!simple && (
        <p className="people-note">
          Un paciente <strong>anónimo</strong> no tiene cuenta ni contraseña. Sirve para anotarlo sin que tenga que registrarse. Podés
          corregirle los datos cuando quieras. Si más adelante se registra con ese mismo email, la cuenta pasa a ser real y conserva
          todo lo que le hayas cargado.
        </p>
      )}

      {/* Arranca en los propios: es lo que se busca casi siempre. Ver a todos sirve
          cuando hay que darle turno a alguien que todavía no se atendió acá. */}
      <div className="patients-scope" role="group" aria-label="Qué pacientes mostrar">
        <button
          type="button"
          className={`adm-btn adm-btn-ghost ${scope === "mine" ? "active" : ""}`}
          aria-pressed={scope === "mine"}
          onClick={() => setScope("mine")}
        >
          Mis pacientes
        </button>
        <button
          type="button"
          className={`adm-btn adm-btn-ghost ${scope === "all" ? "active" : ""}`}
          aria-pressed={scope === "all"}
          onClick={() => {
            // Ver a todos no trae la deuda: dejar el filtro puesto vaciaría la lista sin
            // que se entienda por qué.
            setOnlyDebtors(false);
            setScope("all");
          }}
        >
          Todos los pacientes
        </button>

        {/* Contra el borde derecho y solo entre los propios: es un recorte de esa lista. */}
        {scope === "mine" && (
          <button
            type="button"
            className={`adm-btn adm-btn-ghost patients-debt-filter ${onlyDebtors ? "active" : ""}`}
            aria-pressed={onlyDebtors}
            disabled={debtors === 0 && !onlyDebtors}
            title={debtors === 0 ? "Nadie te quedó debiendo" : "Solo los que te quedaron debiendo"}
            onClick={() => setOnlyDebtors(!onlyDebtors)}
          >
            <FaMoneyBillWave />
            Adeudan
            <span className="adm-chip-count">{debtors}</span>
          </button>
        )}
      </div>

      <PeopleSearch value={search} onChange={setSearch} placeholder="Buscar por nombre, apellido o email" />

      <div className="adm-panel">
        {loading ? (
          <SkeletonList rows={6} />
        ) : patients.length === 0 ? (
          <div className="adm-empty">
            {scope === "mine"
              ? "Todavía no le diste turno a nadie. Acá van a aparecer los pacientes que atiendas."
              : "Todavía no hay pacientes cargados."}
          </div>
        ) : filtered.length === 0 ? (
          <div className="adm-empty">Ningún paciente coincide con la búsqueda.</div>
        ) : (
          <PeopleList>
            {filtered.map((patient) => (
              <PersonRow
                key={patient.email}
                name={patient.name}
                surname={patient.surname}
                meta={patient.email}
                tone={patient.anonymous ? "amber" : "green"}
                badges={[
                  patient.anonymous
                    ? { label: "Anónimo", tone: "amber" as const }
                    : { label: "Con cuenta", tone: "green" as const },
                  // Un pago a medias también es una deuda: lo que se mira es si quedó algo
                  // sin cobrar, no si no pagó nada.
                  ...(patient.owesPayment
                    ? [
                        {
                          label:
                            (patient.owedAppointments ?? 0) === 1 ? "Adeuda un pago" : `Adeuda ${patient.owedAppointments} pagos`,
                          tone: "red" as const,
                          hint: `Le quedaron $${patient.owedAmount ?? 0} sin pagar. Se registra desde la ficha de cada turno.`,
                        },
                      ]
                    : []),
                ]}
                onClick={() => {
                  setEditing(patient);
                  setModalOpen(true);
                }}
                // Solo en los propios: contactar a alguien que nunca atendiste no es
                // una acción que la pantalla tenga por qué ofrecer.
                action={
                  scope === "mine" ? (
                    <button
                      type="button"
                      className="adm-btn adm-btn-ghost adm-btn-sm"
                      onClick={() => setContacting(patient)}
                    >
                      <FaAddressBook />
                      Contactar
                    </button>
                  ) : undefined
                }
              />
            ))}
          </PeopleList>
        )}
      </div>

      <ContactPatientModal
        open={!!contacting}
        onClose={() => setContacting(undefined)}
        patient={contacting}
        professional={me}
      />

      <PatientDetailModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        patient={editing}
        historyToken={historyToken}
        onOpenAppointment={turno.open}
        onFailed={() => remember(null)}
        onSaved={(saved, previous) => {
          if (previous) {
            setPatients((prev) => prev.map((p) => (p.email === previous.email ? { ...p, ...saved } : p)));
            // Los datos de antes, tal como estaban en la fila. Solo se puede sobre un
            // paciente sin cuenta, que son los únicos que este profesional puede editar.
            remember({
              label: "Volvieron los datos anteriores del paciente",
              undo: async () => {
                const vuelto = await updatePatient(previous.email, {
                  name: previous.name,
                  surname: previous.surname,
                  docType: previous.docType || "DNI",
                  docNumber: previous.docNumber || "",
                  phoneNumber: previous.phoneNumber || "",
                });
                setPatients((prev) => prev.map((p) => (p.email === previous.email ? { ...p, ...vuelto } : p)));
              },
            });
            return;
          }

          setPatients((prev) => [saved, ...prev]);
          // Deshacer el alta lo borra de verdad. El backend solo lo deja mientras no tenga
          // ningún turno, que recién creado es siempre el caso.
          remember({
            label: `Se borró el paciente ${saved.surname}, ${saved.name}`,
            undo: async () => {
              await deleteAnonymousPatient(saved.email);
              setPatients((prev) => prev.filter((p) => p.email !== saved.email));
            },
          });
        }}
      />

      {/* La ficha del turno que se abre desde el historial. Va afuera de la ventana del
          paciente y no adentro: una ventana adentro de otra hereda su ancho y su scroll,
          y esta ficha es más alta que la de un paciente. */}
      {me && <AppointmentDetailModal {...turno.detailProps} user={me} />}
    </div>
  );
}
