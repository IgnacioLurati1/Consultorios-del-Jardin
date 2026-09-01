import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { errorMessage } from "../../../api/client";
import { createProvince, findProvinces, renameProvince, toggleProvince } from "../../../api/catalog";
import { Province } from "../../../api/types";
import { Button } from "../../../components/Button";
import { Field } from "../../../components/Field";
import { useFeedback } from "../../../components/Feedback";
import { Catalog } from "../../../features/Catalog";
import { space } from "../../../theme/tokens";

export default function ProvincesScreen() {
  return (
    <Catalog<Province>
      what="provincias"
      one="provincia"
      feminine
      load={findProvinces}
      present={(province) => ({
        id: String(province.idProvince),
        title: province.nameProvince,
        active: province.active,
      })}
      onToggle={(province) => toggleProvince(String(province.idProvince))}
      form={(editing, _close, done) => <ProvinceForm editing={editing} done={done} />}
    />
  );
}

function ProvinceForm({ editing, done }: { editing: Province | null; done: () => void }) {
  const feedback = useFeedback();
  const [name, setName] = useState(editing?.nameProvince ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;

    if (name.trim().length < 2) {
      setError("Escribí el nombre de la provincia");
      return;
    }

    setBusy(true);

    try {
      if (editing) await renameProvince(String(editing.idProvince), name.trim());
      else await createProvince(name.trim());

      feedback.done(editing ? "Guardamos el cambio" : "Provincia creada");
      done();
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      <Field
        label="Nombre"
        value={name}
        onChangeText={(value) => {
          setName(value);
          setError(null);
        }}
        placeholder="Santa Fe"
        autoCapitalize="words"
        error={error}
        required
      />

      <Button label={editing ? "Guardar" : "Crear"} onPress={save} loading={busy} block />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg, paddingBottom: space.md },
});
