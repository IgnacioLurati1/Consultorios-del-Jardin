import { useEffect, useMemo, useRef, useState } from "react";
import { FaChevronRight, FaMagnifyingGlass, FaTableColumns, FaXmark } from "react-icons/fa6";
import type { Person, Room } from "../../types.ts";
import { SkeletonList } from "../../../components/skeleton/Skeleton.tsx";
import "./professionalPicker.css";
import { roomLook, type RoomPictogram } from "../../../lib/roomLook.ts";
import { FaLeaf, FaRoad, FaStairs } from "react-icons/fa6";

interface ProfessionalPickerProps {
  isOpen: boolean;
  professionals: Person[];
  loading: boolean;
  onSelect: (professional: Person) => void;
  /** Sin nada elegido todavía no hay nada atrás, así que no se puede cerrar. */
  onClose?: () => void;
  /** Si se pasan consultorios, la ventana ofrece además arrancar por consultorio. */
  rooms?: Room[];
  onSelectRoom?: (room: Room) => void;
  /** Tercera puerta: el día completo, sin elegir a nadie en particular. */
  onSelectDay?: () => void;
}

const normalize = (text: string) =>
  text
    ?.normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase() ?? "";

/**
 * Ventana previa de la pantalla de horarios.
 *
 * Tres puertas a lo mismo: un profesional (su agenda de la semana), un consultorio (quién
 * lo ocupa) o un día (todo el equipo a la vez). Ninguna es obligatoria antes que otra.
 *
 * La del día va abajo y no en una tercera columna porque no se busca nada: es un solo
 * botón, y ponerlo al lado de dos buscadores lo haría parecer un tercer buscador vacío.
 */
/** Los dibujos que puede llevar una sala en vez de su inicial. */
const PICTOGRAMS: Record<RoomPictogram, typeof FaLeaf> = {
  leaf: FaLeaf,
  road: FaRoad,
  stairs: FaStairs,
};

/**
 * El iconito de una sala: su color si se llama como uno, y un dibujo en vez de la
 * inicial si se llama como un lugar. Ver roomLook.
 */
function RoomAvatar({ name }: { name?: string | null }) {
  const look = roomLook(name);
  const Pictogram = look?.icon ? PICTOGRAMS[look.icon] : null;

  return (
    <span
      className="picker-item-avatar picker-item-avatar-room"
      style={look?.background ? { background: look.background, color: look.text } : undefined}
    >
      {Pictogram ? <Pictogram aria-hidden="true" /> : name?.charAt(0).toUpperCase()}
    </span>
  );
}

export function ProfessionalPicker({
  isOpen,
  professionals,
  loading,
  onSelect,
  onClose,
  rooms,
  onSelectRoom,
  onSelectDay,
}: ProfessionalPickerProps) {
  const [search, setSearch] = useState("");
  const [roomSearch, setRoomSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const offersRooms = !!rooms && !!onSelectRoom;

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setRoomSearch("");
      // Se enfoca el buscador para poder tipear apenas abre
      const id = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    if (!term) return professionals;

    return professionals.filter(
      (p) =>
        normalize(p.name).includes(term) ||
        normalize(p.surname).includes(term) ||
        normalize(p.speciality).includes(term) ||
        normalize(p.email).includes(term)
    );
  }, [search, professionals]);

  const filteredRooms = useMemo(() => {
    if (!rooms) return [];
    const term = normalize(roomSearch.trim());
    if (!term) return rooms;
    return rooms.filter((room) => normalize(room.description).includes(term));
  }, [roomSearch, rooms]);

  if (!isOpen) return null;

  return (
    <div className="picker-overlay" onClick={() => onClose?.()}>
      <div
        className={`picker-window ${offersRooms ? "picker-window-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Elegir profesional o consultorio"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="picker-head">
          <div>
            <h2 className="picker-title">{offersRooms ? "¿Qué querés ver?" : "Buscar profesional"}</h2>
            <p className="picker-subtitle">
              {offersRooms ? "Un profesional, un consultorio o un día entero." : "Elegí de quién querés ver la agenda semanal."}
            </p>
          </div>
          {onClose && (
            <button className="picker-close" onClick={onClose} aria-label="Cerrar">
              <FaXmark />
            </button>
          )}
        </div>

        <div className={`picker-body ${offersRooms ? "picker-body-split" : ""}`}>
          {/* ---- columna: profesional ---- */}
          <section className="picker-pane">
            {offersRooms && <h3 className="picker-pane-title">Profesional</h3>}

            <div className="picker-search">
              <FaMagnifyingGlass className="picker-search-icon" />
              <input
                ref={inputRef}
                className="picker-search-input"
                type="text"
                placeholder="Nombre, apellido, especialidad o email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="picker-results">
              {loading ? (
                <SkeletonList rows={4} />
              ) : professionals.length === 0 ? (
                <div className="picker-empty">No hay profesionales activos cargados.</div>
              ) : filtered.length === 0 ? (
                <div className="picker-empty">Ningún profesional coincide con “{search}”.</div>
              ) : (
                <ul className="picker-list">
                  {filtered.map((professional) => (
                    <li key={professional.email}>
                      <button className="picker-item" onClick={() => onSelect(professional)}>
                        <span className="picker-item-avatar">
                          {professional.name?.charAt(0).toUpperCase()}
                          {professional.surname?.charAt(0).toUpperCase()}
                        </span>
                        <span className="picker-item-text">
                          <span className="picker-item-name">
                            {professional.surname}, {professional.name}
                          </span>
                          <span className="picker-item-meta">
                            {professional.speciality || "Sin especialidad"} · {professional.email}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* ---- separador "o" ---- */}
          {offersRooms && (
            <div className="picker-divider" aria-hidden="true">
              <span className="picker-divider-line" />
              <span className="picker-divider-word">o</span>
              <span className="picker-divider-line" />
            </div>
          )}

          {/* ---- columna: consultorio ---- */}
          {offersRooms && (
            <section className="picker-pane">
              <h3 className="picker-pane-title">Consultorio</h3>

              <div className="picker-search">
                <FaMagnifyingGlass className="picker-search-icon" />
                <input
                  className="picker-search-input"
                  type="text"
                  placeholder="Nombre del consultorio"
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                />
              </div>

              <div className="picker-results">
                {rooms!.length === 0 ? (
                  <div className="picker-empty">No hay consultorios activos cargados.</div>
                ) : filteredRooms.length === 0 ? (
                  <div className="picker-empty">Ningún consultorio coincide con “{roomSearch}”.</div>
                ) : (
                  <ul className="picker-list">
                    {filteredRooms.map((room) => (
                      <li key={room.idRoom}>
                        <button className="picker-item" onClick={() => onSelectRoom!(room)}>
                          <RoomAvatar name={room.description} />
                          <span className="picker-item-text">
                            <span className="picker-item-name">{room.description}</span>
                            <span className="picker-item-meta">Ver ocupación completa</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}
        </div>

        {onSelectDay && (
          <div className="picker-foot">
            <button type="button" className="picker-day" onClick={onSelectDay}>
              <span className="picker-day-icon">
                <FaTableColumns />
              </span>
              <span className="picker-day-text">
                <strong>Ver un día completo</strong>
                <small>Todos los profesionales, consultorio por consultorio</small>
              </span>
              <FaChevronRight className="picker-day-go" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
