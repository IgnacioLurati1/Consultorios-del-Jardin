import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { errorMessage } from "../../../api/client";
import { createCity, findActiveProvinces, findCities, toggleCity, updateCity } from "../../../api/catalog";
import { City, Province } from "../../../api/types";
import { Button } from "../../../components/Button";
import { Field, PickerField } from "../../../components/Field";
import { useFeedback } from "../../../components/Feedback";
import { OptionSheet } from "../../../components/Sheet";
import { Catalog } from "../../../features/Catalog";
import { space } from "../../../theme/tokens";

export default function CitiesScreen() {
  return (
    <Catalog<City>
      what="localidades"
      one="localidad"
      feminine
      load={findCities}
      present={(city) => ({
        id: String(city.idCity),
        title: city.nameCity,
        subtitle: city.province?.nameProvince,
        active: city.active,
      })}
      onToggle={(city) => toggleCity(String(city.idCity))}
      form={(editing, _close, done) => <CityForm editing={editing} done={done} />}
    />
  );
}

function CityForm({ editing, done }: { editing: City | null; done: () => void }) {
  const feedback = useFeedback();

  const [name, setName] = useState(editing?.nameCity ?? "");
  const [province, setProvince] = useState<string>(editing ? String(editing.province?.idProvince ?? "") : "");
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [sheet, setSheet] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Solo las activas: no tiene sentido colgar una localidad de una provincia dada de baja.
    findActiveProvinces().then(setProvinces).catch(() => setProvinces([]));
  }, []);

  const chosen = provinces.find((item) => String(item.idProvince) === province);

  async function save() {
    if (busy) return;

    const found = {
      name: name.trim().length >= 2 ? null : "Escribí el nombre de la localidad",
      province: province ? null : "Elegí a qué provincia pertenece",
    };

    setErrors(found);
    if (found.name || found.province) return;

    setBusy(true);

    try {
      if (editing) await updateCity(String(editing.idCity), name.trim(), province);
      else await createCity(name.trim(), province);

      feedback.done(editing ? "Guardamos el cambio" : "Localidad creada");
      done();
    } catch (problem) {
      setErrors({ name: errorMessage(problem) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      <Field
        label="Nombre"
        value={name}
        onChangeText={setName}
        placeholder="Rosario"
        autoCapitalize="words"
        error={errors.name}
        required
      />

      <PickerField
        label="Provincia"
        value={chosen?.nameProvince}
        placeholder="Elegir una provincia"
        onPress={() => setSheet(true)}
        error={errors.province}
        required
      />

      <Button label={editing ? "Guardar" : "Crear"} onPress={save} loading={busy} block />

      <OptionSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Provincia"
        options={provinces.map((item) => ({ key: String(item.idProvince), label: item.nameProvince }))}
        selected={province}
        onSelect={setProvince}
        emptyLabel="No hay provincias habilitadas. Creá una primero."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg, paddingBottom: space.md },
});
