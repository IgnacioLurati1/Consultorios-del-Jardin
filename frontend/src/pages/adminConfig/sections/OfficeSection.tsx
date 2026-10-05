import { words } from "../../../lib/vocabulary.ts";
import { Section, TextField, type SectionProps } from "../fields.tsx";

/** Cómo se llama el consultorio, dónde queda y cómo se lo contacta. */
export function OfficeSection({ draft, set }: SectionProps) {
  return (
    <Section title={words(draft.vocabulary).Lugar}>
      <TextField label="Nombre" value={draft.name} onChange={(v) => set("name", v)} max={120} />
      <TextField label="Bajada de la portada" value={draft.tagline} onChange={(v) => set("tagline", v)} max={200} wide />
      <TextField label="Dirección" value={draft.address} onChange={(v) => set("address", v)} max={160} hint="Calle y número" />
      <TextField label="Ciudad" value={draft.city} onChange={(v) => set("city", v)} max={80} />
      <TextField label="Horario de atención" value={draft.publicHours} onChange={(v) => set("publicHours", v)} max={120} />
      <TextField label="Casilla de contacto" value={draft.email} onChange={(v) => set("email", v)} max={160} />
      <TextField
        label="Teléfono"
        value={draft.phone ?? ""}
        onChange={(v) => set("phone", v)}
        max={40}
        hint="Como se marca. Vacío, no se muestra"
      />
      <TextField
        label="WhatsApp"
        value={draft.whatsapp ?? ""}
        onChange={(v) => set("whatsapp", v)}
        max={40}
        hint="Con el código de país, como 54 9 341 555 1234. Vacío, no se muestra"
      />
      <TextField
        label="Instagram"
        value={draft.instagram}
        onChange={(v) => set("instagram", v.replace(/^@/, ""))}
        max={80}
        hint="El usuario, sin arroba"
      />
      <TextField
        label="Consejo del recordatorio"
        value={draft.visitAdvice}
        onChange={(v) => set("visitAdvice", v)}
        max={160}
        hint="Vacío, el recordatorio no lleva consejo"
      />

      <TextField
        label="Mapa"
        value={draft.mapEmbedUrl ?? ""}
        onChange={(v) => set("mapEmbedUrl", v || null)}
        wide
        hint="El link de Insertar un mapa de Google Maps. Vacío, se arma con la dirección"
      />
      <TextField
        label="Cómo llegar"
        value={draft.directionsUrl ?? ""}
        onChange={(v) => set("directionsUrl", v || null)}
        max={400}
        wide
        hint="Vacío, se arma con la dirección"
      />
    </Section>
  );
}
