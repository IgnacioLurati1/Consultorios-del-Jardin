import type { IconType } from "react-icons";
import {
  FaBolt,
  FaCalendarCheck,
  FaCalendarDays,
  FaChartColumn,
  FaSeedling,
  FaSliders,
  FaUserPlus,
} from "react-icons/fa6";
import type { Words } from "../../../lib/vocabulary.ts";

export interface GuideStep {
  icon: IconType;
  title: string;
  text: string;
  /** El camino hasta la pantalla, con los mismos nombres que tienen los botones. */
  where?: string;
}

/**
 * Lo que hay que saber para arrancar, en el orden en que se usa.
 *
 * Una idea por paso y dos o tres oraciones como mucho. Lo que se deja afuera (importar un
 * calendario, la lista de espera, los atajos de teclado) se descubre usando el panel. Esta
 * guía es para que el primer día nadie se quede sin saber dónde se da un turno.
 *
 * Los nombres de `where` son los que se leen en pantalla. Si un botón cambia de nombre,
 * cambia acá también.
 *
 * Es una función y no una lista fija porque las palabras del rubro llegan del servidor
 * después de que se carga este archivo.
 */
export function guideSteps(w: Words): GuideStep[] {
  // "Es el que..." retoma al turno: con una palabra femenina pasa a "Es la que...".
  const elTurno = w.lo("turno") === "la" ? "la" : "el";

  return [
    {
      icon: FaSeedling,
      title: "Bienvenido/a al panel",
      text: "Un repaso de un minuto por lo más usado. Esta guía se vuelve a abrir cuando haga falta desde el botón de ayuda, arriba.",
    },
    {
      icon: FaCalendarCheck,
      title: `${w.Turno} normal`,
      text: `Es ${elTurno} que cae dentro de los horarios de atención y dura lo que dura ese módulo. L${w.o("turno")} piden ${w.los("paciente")} desde la web o la app, y también se carga a mano.`,
      where: `${w.Turnos} › Nuev${w.o("turno")} ${w.turno}`,
    },
    {
      icon: FaBolt,
      title: `${w.Turno} especial`,
      text: `Es ${w.un("turno")} libre, para las excepciones. Dura lo que haga falta y va en ${w.el("sala")} que haga falta, incluso fuera de los horarios de atención. ${w.Los("paciente")} no ${w.lo("turno")} pueden pedir, se carga solo desde el panel.`,
      where: `${w.Turnos} › Nuev${w.o("turno")} ${w.turno} › ${w.Turno} especial`,
    },
    {
      icon: FaCalendarDays,
      title: "Horarios",
      text: `Los módulos de atención de la semana, con ${w.el("sala")} y la duración de cada ${w.turno}. Los carga la administración, y de ellos salen ${w.los("turno")} normales.`,
      where: "Horarios",
    },
    {
      icon: FaUserPlus,
      title: `${w.Pacientes} sin cuenta`,
      text: `Para darle ${w.turno} a alguien que no se registró. Alcanza con el email, el nombre y el apellido. Lo ven solo quien lo cargó y la administración, y si después se registra con ese email conserva todo.`,
      where: `${w.Pacientes} › Nuev${w.o("paciente")} ${w.paciente} sin cuenta`,
    },
    {
      icon: FaChartColumn,
      title: "Números",
      text: `La facturación, ${w.los("paciente")} y la carga de la agenda, mes a mes.`,
      where: "Números",
    },
    {
      icon: FaSliders,
      title: "Configuración rápida",
      text: `Al final de este panel. Confirmar ${w.los("turno")} automáticamente, cerrar l${w.os("turno")} que ya pasaron, ${w.los("turno")} repetibles, las vacaciones y la vista simplificada.`,
      where: "Panel › Configuración",
    },
  ];
}
