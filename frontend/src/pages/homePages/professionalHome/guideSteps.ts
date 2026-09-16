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
 */
export const GUIDE_STEPS: GuideStep[] = [
  {
    icon: FaSeedling,
    title: "Bienvenido/a al panel",
    text: "Un repaso de un minuto por lo más usado. Esta guía se vuelve a abrir cuando haga falta desde el botón de ayuda, arriba.",
  },
  {
    icon: FaCalendarCheck,
    title: "Turno normal",
    text: "Es el que cae dentro de los horarios de atención y dura lo que dura ese módulo. Lo piden los pacientes desde la web o la app, y también se carga a mano.",
    where: "Turnos › Nuevo turno",
  },
  {
    icon: FaBolt,
    title: "Turno especial",
    text: "Es un turno libre, para las excepciones. Dura lo que haga falta y va en el consultorio que haga falta, incluso fuera de los horarios de atención. Los pacientes no lo pueden pedir, se carga solo desde el panel.",
    where: "Turnos › Nuevo turno › Turno especial",
  },
  {
    icon: FaCalendarDays,
    title: "Horarios",
    text: "Los módulos de atención de la semana, con el consultorio y la duración de cada turno. Los carga la administración, y de ellos salen los turnos normales.",
    where: "Horarios",
  },
  {
    icon: FaUserPlus,
    title: "Pacientes sin cuenta",
    text: "Para darle turno a alguien que no se registró. Alcanza con el email, el nombre y el apellido. Lo ven solo quien lo cargó y la administración, y si después se registra con ese email conserva todo.",
    where: "Pacientes › Nuevo paciente sin cuenta",
  },
  {
    icon: FaChartColumn,
    title: "Números",
    text: "La facturación, los pacientes y la carga de la agenda, mes a mes.",
    where: "Números",
  },
  {
    icon: FaSliders,
    title: "Configuración rápida",
    text: "Al final de este panel. Confirmar los turnos automáticamente, cerrar los que ya pasaron, los turnos repetibles, las vacaciones y la vista simplificada.",
    where: "Panel › Configuración",
  },
];
