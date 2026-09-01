import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { errorMessage } from "../../../api/client";
import { createOffice, findActiveCities, findOffices, toggleOffice, updateOffice } from "../../../api/catalog";
import { City, Office } from "../../../api/types";
import { Button } from "../../../components/Button";
import { Field, PickerField } from "../../../components/Field";
import { useFeedback } from "../../../components/Feedback";
import { OptionSheet } from "../../../components/Sheet";
import { Catalog } from "../../../features/Catalog";
import { TimeField } from "../../../features/DateField";
import { hhmm } from "../../../lib/dates";
import { space } from "../../../theme/tokens";

/** Una sede del consultorio. En la interfaz siempre se dice "sucursal". */
export default function OfficesScreen() {
  return (
    <Catalog<Office>
      what="sucursales"
      one="sucursal"
      feminine
      load={findOffices}
      present={(office) => ({
        id: String(office.idOffice),
        title: office.description,
        subtitle: `${hhmm(office.openingTime)} a ${hhmm(office.closingTime)}${
          office.city?.nameCity ? ` · ${office.city.nameCity}` : ""
        }`,
        active: office.active,
      })}
      onToggle={(office) => toggleOffice(String(office.idOffice))}
      form={(editing, _close, done) => <OfficeForm editing={editing} done={done} />}
    />
  );
}

function OfficeForm({ editing, done }: { editing: Office | null; done: () => void }) {
  const feedback = useFeedback();

  const [description, setDescription] = useState(editing?.description ?? "");
  const [opening, setOpening] = useState<string | null>(editing ? hhmm(editing.openingTime) : null);
  const [closing, setClosing] = useState<string | null>(editing ? hhmm(editing.closingTime) : null);
  const [city, setCity] = useState<string>(editing ? String(editing.city?.idCity ?? "") : "");
  const [cities, setCities] = useState<City[]>([]);
  const [sheet, setSheet] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    findActiveCities().then(setCities).catch(() => setCities([]));
  }, []);

  const chosen = cities.find((item) => String(item.idCity) === city);

  async function save() {
    if (busy) return;

    const found = {
      description: description.trim().length >= 2 ? null : "Escribí cómo se llama la sucursal",
      opening: opening ? null : "Elegí a qué hora abre",
      closing: !closing ? "Elegí a qué hora cierra" : opening && closing <= opening ? "Tiene que cerrar después de abrir" : null,
      city: city ? null : "Elegí en qué localidad está",
    };

    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setBusy(true);

    try {
      const input = { description: description.trim(), openingTime: opening!, closingTime: closing!, city };

      if (editing) await updateOffice(String(editing.idOffice), input);
      else await createOffice(input);

      feedback.done(editing ? "Guardamos el cambio" : "Sucursal creada");
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
        placeholder="Sede 9 de Julio"
        autoCapitalize="sentences"
        error={errors.description}
        required
      />

      <View style={styles.times}>
        <View style={styles.time}>
          <TimeField label="Abre" value={opening} onChange={setOpening} error={errors.opening} required />
        </View>
        <View style={styles.time}>
          <TimeField label="Cierra" value={closing} onChange={setClosing} error={errors.closing} required />
        </View>
      </View>

      <PickerField
        label="Localidad"
        value={chosen?.nameCity}
        placeholder="Elegir una localidad"
        onPress={() => setSheet(true)}
        error={errors.city}
        required
      />

      <Button label={editing ? "Guardar" : "Crear"} onPress={save} loading={busy} block />

      <OptionSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Localidad"
        options={cities.map((item) => ({
          key: String(item.idCity),
          label: item.nameCity,
          description: item.province?.nameProvince,
        }))}
        selected={city}
        onSelect={setCity}
        emptyLabel="No hay localidades habilitadas. Creá una primero."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg, paddingBottom: space.md },
  times: { flexDirection: "row", gap: space.md },
  time: { flex: 1 },
});
