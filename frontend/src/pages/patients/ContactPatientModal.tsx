import { FaEnvelope, FaPhone, FaWhatsapp } from "react-icons/fa6";
import { Modal } from "../../components/modal/Modal.tsx";
import type { Person } from "../types.ts";
import { gmailToPatientUrl, prettyPhone, whatsappUrl } from "./contactPatient.ts";

interface ContactPatientModalProps {
  open: boolean;
  onClose: () => void;
  patient: Person | undefined;
  /** Quién escribe: su nombre va como firma del borrador. */
  professional: Person | undefined;
}

/**
 * Cómo ubicar a un paciente.
 *
 * Los datos están y siempre estuvieron en la ficha, pero enterrados entre los campos que
 * se editan: para llamar a alguien había que abrir el formulario, encontrar el teléfono
 * y copiarlo a mano. Acá los dos datos que sirven para eso están solos y son accionables,
 * que es la diferencia entre tener un dato y poder usarlo.
 */
export function ContactPatientModal({ open, onClose, patient, professional }: ContactPatientModalProps) {
  if (!patient) return null;

  const phone = prettyPhone(patient.phoneNumber);
  const whatsapp = whatsappUrl(patient.phoneNumber);
  const digits = (patient.phoneNumber ?? "").replace(/\D/g, "");

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={`${patient.surname}, ${patient.name}`}
      subtitle="Cómo contactarlo"
      footer={
        <>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>
            Cerrar
          </button>
          <a
            className="adm-btn adm-btn-primary"
            href={gmailToPatientUrl(patient, professional)}
            target="_blank"
            rel="noreferrer"
          >
            <FaEnvelope />
            Escribirle
          </a>
        </>
      }
    >
      <div className="ui-section">
        <div className="ui-detail-list">
          <div className="ui-detail-row">
            <span>Email</span>
            <strong>{patient.email}</strong>
          </div>
          <div className="ui-detail-row">
            <span>Teléfono</span>
            <strong>{phone ?? <span className="ui-detail-empty">sin cargar</span>}</strong>
          </div>
        </div>

        {/* En la computadora el link de teléfono no hace nada útil, pero esta misma
            pantalla se abre desde el celular, que es desde donde uno llama. */}
        {digits.length === 10 && (
          <div className="patients-contact-actions">
            <a className="adm-btn adm-btn-ghost" href={`tel:+549${digits}`}>
              <FaPhone />
              Llamarlo
            </a>
            {whatsapp && (
              <a className="adm-btn adm-btn-ghost" href={whatsapp} target="_blank" rel="noreferrer">
                <FaWhatsapp />
                WhatsApp
              </a>
            )}
          </div>
        )}

        <p className="ui-hint">
          "Escribirle" abre Gmail con el mensaje empezado. Podés cambiarlo antes de mandarlo.
        </p>
      </div>
    </Modal>
  );
}
