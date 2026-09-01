import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FaFilePdf } from "react-icons/fa6";
import { AdminHeader } from "../../components/adminHeader/AdminHeader.tsx";
import { SkeletonLine } from "../../components/skeleton/Skeleton.tsx";
import { Toasts } from "../../components/toast/Toasts.tsx";
import { ProfessionalReport } from "./ProfessionalReport.tsx";
import { findMyAnalytics, type ProfessionalAnalytics } from "./analyticsService.ts";
import "../adminCRUDS/adminPanel.css";
import "./analytics.css";

/** Los números del profesional logueado. */
export function AnalyticsPage() {
  const [data, setData] = useState<ProfessionalAnalytics | null>(null);

  useEffect(() => {
    findMyAnalytics()
      .then(setData)
      .catch((err) => toast.error(`No pudimos cargar los números: ${err.message}`));
  }, []);

  return (
    <div className="adm-page an-page">
      <AdminHeader
        title="Números"
        subtitle="Tu facturación, tus turnos y cómo se movieron mes a mes"
        backTo="/ProfessionalHome"
        actions={
          <button type="button" className="adm-btn adm-btn-ghost" disabled={!data} onClick={() => window.print()}>
            <FaFilePdf />
            Exportar a PDF
          </button>
        }
      />

      <Toasts />

      {!data ? (
        <div className="adm-panel">
          <div className="prof-today-loading">
            <SkeletonLine height={20} />
            <SkeletonLine width="70%" height={20} />
            <SkeletonLine width="45%" height={20} />
          </div>
        </div>
      ) : (
        <ProfessionalReport data={data} />
      )}
    </div>
  );
}
