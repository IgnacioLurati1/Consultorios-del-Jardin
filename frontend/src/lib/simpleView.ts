import { createPreference } from "./preference";

/**
 * La vista simplificada del profesional.
 *
 * Deja en pantalla lo que hace falta para atender —la agenda, los pacientes, dar y cobrar
 * turnos— y esconde las herramientas que se usan una vez cada tanto. No apaga nada: lo
 * que estaba prendido sigue funcionando igual, solo deja de dibujarse. Por eso la única
 * forma de volver a ver esas funciones es apagar el modo, y eso es lo que avisa el cartel
 * cuando se prende.
 *
 * Qué esconde, en un solo lugar para que se pueda leer de un vistazo:
 *
 * - En el panel, los tres bloques de abajo —la agenda de hoy, los pedidos pendientes y lo
 *   que quedó sin cobrar— y el cartel de atajos de teclado. El panel queda en las cuatro
 *   tarjetas y la configuración, que es desde donde se llega a todo lo demás.
 * - En los turnos, importar y exportar el calendario.
 * - En la configuración, las dos automatizaciones que estén apagadas, los avisos por mail
 *   si están todos prendidos, y borrar los turnos de un paciente.
 *
 * Lo que no esconde nunca: las cuatro tarjetas del panel, nada que cambie un turno, un
 * cobro o un paciente, y ninguna opción que esté prendida. Esconder un interruptor
 * encendido dejaría al profesional sin forma de apagarlo, que es exactamente lo contrario
 * de simplificar. Nada de lo que se esconde deja de ser accesible: la agenda del día, los
 * pedidos y lo impago están todos en la pantalla de turnos.
 */
export const useSimpleView = createPreference("vista-simple");
