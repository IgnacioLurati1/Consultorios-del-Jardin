import { FaAngleDown } from "react-icons/fa";
import { FaXmark } from "react-icons/fa6";
import { useMemo, useState } from "react";
import type { GridFilterProps } from "../scheduleTypes.ts";
import "./gridFilter.css";

/**
 * Filtro de la grilla de horarios.
 *
 * Ya no busca profesionales (eso pasó a la ventana previa) ni filtra por consultorio.
 * Queda una sola dimensión: el consultorio. Y tiene dos usos según el modo:
 *  - modo profesional: acota la agenda del profesional a un consultorio.
 *  - modo consultorio: muestra la ocupación completa de ese consultorio, de todos los profesionales,
 *    para ver dónde entra un profesional nuevo.
 */
export function GridFilter({ rooms, viewMode, selectedRoom, onSelectRoom, onClearRoom, onShowRoomOccupancy }: GridFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const normalize = (text: string) =>
    text
      ?.normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase() ?? "";

  const filteredRooms = useMemo(() => {
    const term = normalize(search.trim());
    if (!term) return rooms;
    return rooms.filter((room) => normalize(room.description).includes(term));
  }, [search, rooms]);

  return (
    <div className="filter-container">
      <button type="button" className="filter-selector" onClick={() => setOpen(!open)} aria-expanded={open}>
        {selectedRoom ? `Consultorio: ${selectedRoom.description}` : "Filtrar por consultorio"}
        <FaAngleDown className={open ? "icon rotated" : "icon"} />
      </button>

      <div className={"filter-options" + (open ? " active" : " disabled")}>
        {selectedRoom && (
          <button type="button" className="delete-filters" onClick={onClearRoom}>
            <FaXmark />
            Quitar filtro de consultorio
          </button>
        )}

        <div className="filter-option">
          <input
            className="filter-input"
            placeholder="Buscar consultorio"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <ul className="filter-list active">
            {filteredRooms.length === 0 ? (
              <li className="filter-list-empty">No hay consultorios para mostrar</li>
            ) : (
              filteredRooms.map((room) => (
                <li key={room.idRoom}>
                  <button
                    type="button"
                    className={`filter-list-item ${selectedRoom?.idRoom === room.idRoom ? "selected" : ""}`}
                    onClick={() => {
                      onSelectRoom(room);
                      setOpen(false);
                    }}
                  >
                    {room.description}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        {selectedRoom && viewMode === "professional" && (
          <button type="button" className="filter-occupancy" onClick={() => { onShowRoomOccupancy(); setOpen(false); }}>
            Ver ocupación completa del consultorio
          </button>
        )}
      </div>
    </div>
  );
}
