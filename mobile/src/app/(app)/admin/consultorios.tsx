import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { errorMessage } from "../../../api/client";
import { createRoom, findActiveOffices, findRooms, toggleRoom, updateRoom } from "../../../api/catalog";
import { Office, Room } from "../../../api/types";
import { Button } from "../../../components/Button";
import { Field, PickerField } from "../../../components/Field";
import { useFeedback } from "../../../components/Feedback";
import { OptionSheet } from "../../../components/Sheet";
import { Catalog } from "../../../features/Catalog";
import { space } from "../../../theme/tokens";

/** Una sala de atención. En la interfaz siempre se dice "consultorio". */
export default function RoomsScreen() {
  return (
    <Catalog<Room>
      what="consultorios"
      one="consultorio"
      load={findRooms}
      present={(room) => ({
        id: String(room.idRoom),
        title: room.description,
        subtitle: room.office?.description,
        active: room.active,
      })}
      onToggle={(room) => toggleRoom(String(room.idRoom))}
      form={(editing, _close, done) => <RoomForm editing={editing} done={done} />}
    />
  );
}

function RoomForm({ editing, done }: { editing: Room | null; done: () => void }) {
  const feedback = useFeedback();

  const [description, setDescription] = useState(editing?.description ?? "");
  const [office, setOffice] = useState<string>(editing ? String(editing.office?.idOffice ?? "") : "");
  const [offices, setOffices] = useState<Office[]>([]);
  const [sheet, setSheet] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    findActiveOffices().then(setOffices).catch(() => setOffices([]));
  }, []);

  const chosen = offices.find((item) => String(item.idOffice) === office);

  async function save() {
    if (busy) return;

    const found = {
      description: description.trim().length >= 1 ? null : "Escribí cómo se llama el consultorio",
      office: office ? null : "Elegí en qué sucursal está",
    };

    setErrors(found);
    if (found.description || found.office) return;

    setBusy(true);

    try {
      if (editing) await updateRoom(String(editing.idRoom), description.trim(), office);
      else await createRoom(description.trim(), office);

      feedback.done(editing ? "Guardamos el cambio" : "Consultorio creado");
      done();
    } catch (problem) {
      setErrors({ description: errorMessage(problem) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      <Field
        label="Nombre"
        value={description}
        onChangeText={setDescription}
        placeholder="Consultorio 1"
        autoCapitalize="sentences"
        error={errors.description}
        required
      />

      <PickerField
        label="Sucursal"
        value={chosen?.description}
        placeholder="Elegir una sucursal"
        onPress={() => setSheet(true)}
        error={errors.office}
        required
      />

      <Button label={editing ? "Guardar" : "Crear"} onPress={save} loading={busy} block />

      <OptionSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Sucursal"
        options={offices.map((item) => ({
          key: String(item.idOffice),
          label: item.description,
          description: item.city?.nameCity,
        }))}
        selected={office}
        onSelect={setOffice}
        emptyLabel="No hay sucursales habilitadas. Creá una primero."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg, paddingBottom: space.md },
});
