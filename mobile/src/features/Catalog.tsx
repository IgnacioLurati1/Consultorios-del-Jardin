import { FontAwesome6 } from "@expo/vector-icons";
import { ReactNode, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { errorMessage } from "../api/client";
import { Button } from "../components/Button";
import { Tag } from "../components/Chip";
import { useFeedback } from "../components/Feedback";
import { Screen } from "../components/Screen";
import { Sheet } from "../components/Sheet";
import { DataState, EmptyState } from "../components/States";
import { Group } from "../components/Surfaces";
import { AppText } from "../components/Text";
import { matches } from "../lib/specialities";
import { useAsync } from "../lib/useAsync";
import { radius, space, TOUCH } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";

/**
 * El molde de los cuatro ABM del admin: provincias, localidades, sucursales y
 * consultorios. Los cuatro son la misma pantalla (una lista que se busca, un panel para
 * crear o editar, y dar de baja en vez de borrar), así que la forma vive acá y cada uno
 * solo pone sus campos.
 *
 * Nada se borra de verdad: se marca inactivo. Hay turnos viejos que apuntan a esas filas
 * y tienen que seguir teniendo sentido.
 */

export interface CatalogItem {
  id: string;
  title: string;
  subtitle?: string;
  active: boolean;
}

interface Props<T> {
  /** Qué se administra, en plural y en minúscula: "provincias", "sucursales". */
  what: string;
  /** Cómo se llama una sola, para los botones: "provincia", "sucursal". */
  one: string;
  /** El artículo que le corresponde, para que los carteles no queden en neutro. */
  feminine?: boolean;
  load: () => Promise<T[]>;
  present: (item: T) => CatalogItem;
  onToggle: (item: T) => Promise<void>;
  /** El formulario. Recibe lo que se está editando, o null si es uno nuevo. */
  form: (editing: T | null, close: () => void, done: () => void) => ReactNode;
}

export function Catalog<T>({ what, one, feminine, load, present, onToggle, form }: Props<T>) {
  const { colors } = useTheme();
  const feedback = useFeedback();

  const state = useAsync(load, []);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const rows = useMemo(() => {
    const term = search.trim();

    return (state.data ?? [])
      .map((item) => ({ item, view: present(item) }))
      .filter(({ view }) => {
        if (!showInactive && !view.active) return false;
        if (!term) return true;
        return matches(view.title, term) || matches(view.subtitle ?? "", term);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.data, search, showInactive]);

  const inactiveCount = (state.data ?? []).filter((item) => !present(item).active).length;
  const article = feminine ? "una" : "un";

  async function toggle(item: T, view: CatalogItem) {
    try {
      await onToggle(item);
      feedback.done(view.active ? `Dimos de baja ${view.title}` : `Volvimos a habilitar ${view.title}`);
      state.reload();
    } catch (problem) {
      feedback.problem(errorMessage(problem));
    }
  }

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(item: T) {
    setEditing(item);
    setFormOpen(true);
  }

  return (
    <>
      <Screen onRefresh={state.refresh} refreshing={state.refreshing}>
        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <FontAwesome6 name="magnifying-glass" size={15} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={`Buscar entre las ${what}`}
            placeholderTextColor={colors.muted}
            selectionColor={colors.green}
            autoCorrect={false}
            accessibilityLabel={`Buscar entre las ${what}`}
            style={[styles.searchInput, { color: colors.text }]}
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={12} accessibilityRole="button" accessibilityLabel="Borrar la búsqueda">
              <FontAwesome6 name="xmark" size={15} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        {inactiveCount > 0 ? (
          <Pressable
            onPress={() => setShowInactive((value) => !value)}
            accessibilityRole="switch"
            accessibilityState={{ checked: showInactive }}
            hitSlop={8}
            style={styles.toggleInactive}
          >
            <FontAwesome6 name={showInactive ? "square-check" : "square"} size={16} color={colors.green} />
            <AppText variant="small" tone="muted">
              Mostrar las dadas de baja ({inactiveCount})
            </AppText>
          </Pressable>
        ) : null}

        <View style={styles.list}>
          <DataState
            loading={state.loading}
            error={state.error}
            empty={rows.length === 0}
            onRetry={state.reload}
            emptyState={
              <EmptyState
                icon="folder-open"
                title={search ? "No encontramos nada así" : `Todavía no hay ${what}`}
                description={search ? "Probá buscando de otra forma." : `Creá ${article} ${one} para empezar.`}
                action={search ? undefined : { label: `Nueva ${one}`, onPress: openNew }}
              />
            }
          >
            <Group>
              {rows.map(({ item, view }, index) => (
                <CatalogRow
                  key={view.id}
                  view={view}
                  last={index === rows.length - 1}
                  onEdit={() => openEdit(item)}
                  onToggle={() => toggle(item, view)}
                />
              ))}
            </Group>
          </DataState>
        </View>

        <View style={styles.newButton}>
          <Button label={`Nueva ${one}`} icon="plus" block onPress={openNew} />
        </View>
      </Screen>

      <Sheet
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Editar ${one}` : `Nueva ${one}`}
      >
        {formOpen
          ? form(editing, () => setFormOpen(false), () => {
              setFormOpen(false);
              state.reload();
            })
          : null}
      </Sheet>
    </>
  );
}

/**
 * Una fila. El nombre abre la edición y el botón de la derecha da de baja o rehabilita:
 * son dos acciones distintas y por eso son dos zonas distintas para tocar.
 */
function CatalogRow({
  view,
  onEdit,
  onToggle,
  last,
}: {
  view: CatalogItem;
  onEdit: () => void;
  onToggle: () => void;
  last: boolean;
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`Editar ${view.title}`}
        android_ripple={{ color: colors.border }}
        style={({ pressed }) => [styles.rowMain, pressed && Platform.OS === "ios" && styles.pressed]}
      >
        <View style={styles.rowText}>
          <AppText variant="body" numberOfLines={1} tone={view.active ? "default" : "muted"}>
            {view.title}
          </AppText>
          {view.subtitle ? (
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {view.subtitle}
            </AppText>
          ) : null}
        </View>

        {!view.active ? <Tag label="De baja" /> : null}
      </Pressable>

      <Pressable
        onPress={onToggle}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={view.active ? `Dar de baja ${view.title}` : `Volver a habilitar ${view.title}`}
        android_ripple={{ color: colors.border, borderless: true }}
        style={({ pressed }) => [styles.rowAction, pressed && Platform.OS === "ios" && styles.pressed]}
      >
        <FontAwesome6
          name={view.active ? "circle-minus" : "circle-plus"}
          size={18}
          color={view.active ? colors.danger : colors.green}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: space.lg,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderRadius: radius.md,
    minHeight: TOUCH + 4,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: space.md },
  toggleInactive: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.md, minHeight: TOUCH - 12 },
  list: { marginTop: space.lg },
  newButton: { marginTop: space.xl },
  row: { flexDirection: "row", alignItems: "center", minHeight: TOUCH + 12 },
  rowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingLeft: space.lg,
    paddingVertical: space.md,
  },
  rowText: { flex: 1, gap: 2 },
  rowAction: { width: TOUCH + 8, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.6 },
});
