import { FontAwesome6 } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { compromisedAccounts, CompromisedAccount } from "../api/security";
import { Button } from "../components/Button";
import { Tag } from "../components/Chip";
import { SkeletonList } from "../components/States";
import { Note, Section } from "../components/Surfaces";
import { AppText } from "../components/Text";
import { useAsync } from "../lib/useAsync";
import { radius, space } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";

const ROLE: Record<string, string> = {
  admin: "Administración",
  professional: "Profesional",
  client: "Paciente",
};

/** "2026-09-02T02:14:00Z" → "2 sep, 02:14". La hora importa más que la fecha acá. */
function when(iso: string | null): string {
  if (!iso) return "sin fecha";

  const date = new Date(iso);
  return `${date.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}, ${date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/** Un 403 es un intento que rebotó; un 200 es algo que efectivamente pasó. */
function outcome(status: number | null): { label: string; tone: "neutral" | "green" | "warn" | "danger" } {
  if (status === null) return { label: "Sin registrar", tone: "neutral" };
  if (status >= 200 && status < 300) return { label: "Salió bien", tone: "danger" };
  if (status === 401 || status === 403) return { label: "Rebotó", tone: "green" };
  return { label: `Error ${status}`, tone: "warn" };
}

/**
 * Las cuentas que el sistema cerró por parecer estar en manos de otra persona, como en
 * los números de la página.
 *
 * Lo importante no es la lista sino el rastro: de lo que llegó a tocar antes de caer
 * dependen las dos decisiones que siguen, si se la vuelve a habilitar y si hay algo que
 * reparar. Por eso "salió bien" va en rojo y "rebotó" en verde: es un daño o un intento.
 *
 * Si no se puede traer, no se dibuja: son números para mirar de paso.
 */
export function CompromisedAccounts() {
  const report = useAsync(compromisedAccounts, []);
  const [open, setOpen] = useState<string | null>(null);

  if (report.error) return null;

  return (
    <Section title="Cuentas cerradas por seguridad">
      {report.loading || !report.data ? (
        <SkeletonList rows={2} height={64} />
      ) : (
        <View style={styles.stack}>
          <Note>
            Se cierra sola la cuenta que toca datos ajenos demasiado rápido o con el consultorio cerrado. Solo otro
            administrador la vuelve a habilitar.
          </Note>

          {report.data.accounts.length === 0 ? (
            <AppText variant="small" tone="muted">
              Ninguna cuenta se comportó así hasta ahora.
            </AppText>
          ) : (
            report.data.accounts.map((account) => (
              <Account
                key={account.email}
                account={account}
                open={open === account.email}
                onToggle={() => setOpen(open === account.email ? null : account.email)}
              />
            ))
          )}
        </View>
      )}
    </Section>
  );
}

function Account({ account, open, onToggle }: { account: CompromisedAccount; open: boolean; onToggle: () => void }) {
  const { colors } = useTheme();
  const done = account.trail.filter((step) => step.status !== null && step.status >= 200 && step.status < 300).length;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: account.active ? colors.warn : colors.border },
      ]}
    >
      <View style={styles.head}>
        <FontAwesome6 name="shield-halved" size={16} color={account.active ? colors.warn : colors.danger} />
        <View style={styles.who}>
          <AppText variant="bodyStrong">
            {account.surname}, {account.name}
          </AppText>
          <AppText variant="caption" tone="muted">
            {account.email} · {ROLE[account.type] ?? account.type} · {when(account.bannedAt)}
          </AppText>
        </View>
      </View>

      <Tag label={account.active ? "Marcada, sin cerrar" : "Acceso cerrado"} tone={account.active ? "warn" : "danger"} />

      <AppText variant="small">{account.reason ?? "Sin motivo registrado"}</AppText>

      {account.active ? (
        <Note tone="warn">Única cuenta de administración activa. Quedó marcada pero con acceso, para revisarla a mano.</Note>
      ) : null}

      {account.trail.length > 0 ? (
        <View style={styles.trail}>
          <View style={styles.toggle}>
            <Button
              label={open ? "Ocultar lo que tocó" : `Ver lo que tocó (${account.trail.length}, ${done} salieron)`}
              variant="ghost"
              onPress={onToggle}
            />
          </View>

          {open
            ? account.trail.map((step, index) => {
                const result = outcome(step.status);

                return (
                  <View
                    key={`${step.at}-${index}`}
                    style={[styles.step, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
                  >
                    <View style={styles.stepText}>
                      <AppText variant="small">{step.label}</AppText>
                      <AppText variant="caption" tone="muted">
                        {when(step.at)}
                      </AppText>
                    </View>
                    <Tag label={result.label} tone={result.tone} />
                  </View>
                );
              })
            : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  card: { gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  who: { flex: 1, gap: 2 },
  trail: { gap: space.xs },
  toggle: { alignItems: "flex-start", marginLeft: -space.md },
  step: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
  stepText: { flex: 1, gap: 2 },
});
