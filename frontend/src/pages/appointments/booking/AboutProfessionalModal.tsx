import { FaEnvelope } from "react-icons/fa6";
import { Modal } from "../../../components/modal/Modal.tsx";
import type { Person } from "../../types.ts";
import { gmailComposeUrl } from "./contactProfessional.ts";

interface AboutProfessionalModalProps {
  open: boolean;
  onClose: () => void;
  professional: Person | undefined;
  /** Quién está mirando: su nombre y su email van en el mensaje. */
  patient: Person | undefined;
}

/**
 * La ficha del profesional, antes de elegir horario.
 *
 * Es lo único de la pantalla que escribió una persona y no el sistema, así que va
 * primero y con el resto de los datos abajo. La mitad de las preguntas que llegan por
 * teléfono —obra social, precio, primera consulta— se contestan acá o con el botón de
 * escribirle.
 */
export function AboutProfessionalModal({ open, onClose, professional, patient }: AboutProfessionalModalProps) {
  if (!professional) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${professional.surname}, ${professional.name}`}
      subtitle={professional.speciality || "Sin especialidad cargada"}
      footer={
        <>
          <a
            className="adm-btn adm-btn-primary"
            href={gmailComposeUrl(professional, patient)}
            target="_blank"
            rel="noreferrer"
          >
            <FaEnvelope />
            Contactar
          </a>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
            Cerrar
          </button>
        </>
      }
    >
      <div className="ui-section">
        {professional.about ? (
          <p className="booking-about">{professional.about}</p>
        ) : (
          <p className="ui-detail-empty">Todavía no escribió su presentación.</p>
        )}
      </div>

      <div className="ui-section">
        <div className="ui-detail-list">
          <div className="ui-detail-row">
            <span>Especialidad</span>
            <strong>{professional.speciality || <span className="ui-detail-empty">sin cargar</span>}</strong>
          </div>
          <div className="ui-detail-row">
            <span>Email</span>
            <strong>{professional.email}</strong>
          </div>
        </div>

        <p className="ui-hint">
          "Contactar" abre Gmail con un mensaje ya escrito. Podés cambiarlo antes de mandarlo.
        </p>
      </div>
    </Modal>
  );
}
