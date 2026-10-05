import { Link } from "react-router-dom";
import { FaChevronDown, FaEnvelope, FaInstagram, FaLocationDot, FaClock, FaPhone, FaWhatsapp } from "react-icons/fa6";
import { usePageMeta } from "../../lib/pageMeta";
import { fullAddress, hasBranches, useInstallation, useWords } from "../../lib/installation";
import { phoneHref, whatsappHref } from "../../lib/contentLists";
import { branchPlace } from "../adminCRUDS/adminOffices/branches.ts";
import { faqQuestions } from "./faqQuestions.tsx";
import "../adminCRUDS/adminPanel.css";
import "./faq.css";

/**
 * Preguntas frecuentes.
 *
 * Las arma cada consultorio desde su panel: las de siempre (ver faqQuestions), ocultas,
 * movidas o reescritas, y las propias.
 *
 * Se abre y se cierra cada una en vez de mostrarlas todas desplegadas porque el valor de
 * esta pantalla está en poder barrer las preguntas con la vista y encontrar la propia.
 * Todas abiertas obligan a leerlas enteras para descartarlas.
 */
export function FaqPage() {
  const w = useWords();
  usePageMeta("/preguntas");
  const installation = useInstallation();
  const instagram = installation.instagram.replace(/^@/, "");

  return (
    <div className="adm-page faq-page">
      <header className="adm-header">
        <div className="adm-header-titles">
          <h1 className="adm-title">Preguntas frecuentes</h1>
          <p className="adm-subtitle">Antes de la primera consulta</p>
        </div>
        <Link className="adm-back" to="/">
          Volver al inicio
        </Link>
      </header>

      <div className="faq-layout">
        <div className="faq-questions">
          {faqQuestions(installation).map((item) => (
            <details key={item.key} className="faq-item">
              <summary className="faq-question">
                {item.q}
                <FaChevronDown className="faq-chevron" aria-hidden="true" />
              </summary>
              <div className="faq-answer">{item.a}</div>
            </details>
          ))}
        </div>

        <aside className="faq-aside">
          <div className="adm-panel faq-card">
            <div className="adm-panel-head">{w.El("lugar")}</div>
            <ul className="faq-facts">
              {hasBranches(installation) ? (
                installation.branches.map((branch) => (
                  <li key={branch.id}>
                    <FaLocationDot aria-hidden="true" />
                    {`${branch.name} · ${branchPlace(branch, installation)}`}
                  </li>
                ))
              ) : (
                <li>
                  <FaLocationDot aria-hidden="true" />
                  {fullAddress(installation)}
                </li>
              )}
              {installation.publicHours ? (
                <li>
                  <FaClock aria-hidden="true" />
                  {installation.publicHours}
                </li>
              ) : null}
              {installation.phone ? (
                <li>
                  <FaPhone aria-hidden="true" />
                  <a href={phoneHref(installation.phone)}>{installation.phone}</a>
                </li>
              ) : null}
              {installation.whatsapp ? (
                <li>
                  <FaWhatsapp aria-hidden="true" />
                  <a href={whatsappHref(installation.whatsapp)} target="_blank" rel="noreferrer">
                    {installation.whatsapp}
                  </a>
                </li>
              ) : null}
              {installation.email ? (
                <li>
                  <FaEnvelope aria-hidden="true" />
                  <a href={`mailto:${installation.email}`}>{installation.email}</a>
                </li>
              ) : null}
              {instagram ? (
                <li>
                  <FaInstagram aria-hidden="true" />
                  <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noreferrer">
                    @{instagram}
                  </a>
                </li>
              ) : null}
            </ul>
          </div>

          <div className="faq-help">
            <p>¿Otra consulta?</p>
            <Link className="adm-btn adm-btn-primary" to="/contacto">
              Contacto
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
