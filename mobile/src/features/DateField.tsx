import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, View } from "react-native";
import { PickerField } from "../components/Field";
import { longDate, toISODate } from "../lib/dates";

/**
 * Elegir una fecha con el calendario del sistema. Es a propósito el del teléfono y no
 * uno propio: la persona ya sabe usarlo, y un calendario hecho a mano nunca queda tan
 * bien como el que trae el sistema operativo.
 *
 * El valor viaja como "YYYY-MM-DD", que es lo que espera el backend.
 */
export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  placeholder = "Elegir una fecha",
  error,
  hint,
  required,
  disabled,
}: {
  label: string;
  value: string | null;
  onChange: (iso: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <PickerField
        label={label}
        value={value ? longDate(value) : null}
        placeholder={placeholder}
        icon="calendar-days"
        onPress={() => setOpen(true)}
        error={error}
        hint={hint}
        required={required}
        disabled={disabled}
      />

      {open ? (
        <DateTimePicker
          value={value ? new Date(`${value}T12:00:00`) : new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          locale="es-AR"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(event, picked) => {
            // En Android el calendario se cierra solo; en iOS queda abierto hasta que se
            // toca afuera, así que se cierra cuando ya eligió.
            setOpen(false);
            if (event.type === "dismissed" || !picked) return;
            onChange(toISODate(picked));
          }}
        />
      ) : null}
    </View>
  );
}

/** Lo mismo pero para una hora. Devuelve "HH:MM". */
export function TimeField({
  label,
  value,
  onChange,
  placeholder = "Elegir un horario",
  error,
  required,
  hint,
}: {
  label: string;
  value: string | null;
  onChange: (hhmm: string) => void;
  placeholder?: string;
  error?: string | null;
  required?: boolean;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <PickerField
        label={label}
        value={value}
        placeholder={placeholder}
        icon="clock"
        onPress={() => setOpen(true)}
        error={error}
        hint={hint}
        required={required}
      />

      {open ? (
        <DateTimePicker
          value={toDate(value)}
          mode="time"
          is24Hour
          display={Platform.OS === "ios" ? "spinner" : "default"}
          locale="es-AR"
          onChange={(event, picked) => {
            setOpen(false);
            if (event.type === "dismissed" || !picked) return;

            const hours = String(picked.getHours()).padStart(2, "0");
            const minutes = String(picked.getMinutes()).padStart(2, "0");
            onChange(`${hours}:${minutes}`);
          }}
        />
      ) : null}
    </View>
  );
}

function toDate(hhmm: string | null): Date {
  const date = new Date();
  if (!hhmm) return date;

  const [hours, minutes] = hhmm.split(":").map(Number);
  date.setHours(hours ?? 9, minutes ?? 0, 0, 0);
  return date;
}
