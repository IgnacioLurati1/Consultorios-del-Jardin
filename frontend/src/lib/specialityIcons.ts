import type { IconType } from "react-icons";
import {
  FaAppleWhole,
  FaBaby,
  FaBone,
  FaBookOpenReader,
  FaBrain,
  FaChild,
  FaDumbbell,
  FaEarListen,
  FaEye,
  FaHandHoldingHeart,
  FaHands,
  FaHeartPulse,
  FaLeaf,
  FaMusic,
  FaPersonRunning,
  FaPuzzlePiece,
  FaSpa,
  FaStethoscope,
  FaTooth,
  FaUserDoctor,
  FaUsers,
} from "react-icons/fa6";

/**
 * Los íconos de las especialidades.
 *
 * Cada especialidad se dibuja en la portada con un ícono sobre su tinte, o con la foto que
 * suba el consultorio. El ícono se propone solo a partir del nombre (ver `suggestIcon`), así
 * una especialidad nueva aparece bien sin que nadie elija nada; desde la configuración se
 * puede cambiar por otro de esta lista.
 *
 * Las claves son las que guarda el servidor: una clave que esta versión no conoce se dibuja
 * con el ícono genérico.
 */
export const SPECIALITY_ICONS: { key: string; label: string; icon: IconType }[] = [
  { key: "brain", label: "Mente", icon: FaBrain },
  { key: "book", label: "Aprendizaje", icon: FaBookOpenReader },
  { key: "stethoscope", label: "Medicina", icon: FaStethoscope },
  { key: "doctor", label: "Médico", icon: FaUserDoctor },
  { key: "apple", label: "Alimentación", icon: FaAppleWhole },
  { key: "ear", label: "Audición y habla", icon: FaEarListen },
  { key: "heart", label: "Corazón", icon: FaHeartPulse },
  { key: "care", label: "Cuidado", icon: FaHandHoldingHeart },
  { key: "hands", label: "Manos", icon: FaHands },
  { key: "tooth", label: "Dientes", icon: FaTooth },
  { key: "bone", label: "Huesos", icon: FaBone },
  { key: "eye", label: "Ojos", icon: FaEye },
  { key: "baby", label: "Bebés", icon: FaBaby },
  { key: "child", label: "Niños", icon: FaChild },
  { key: "puzzle", label: "Desarrollo", icon: FaPuzzlePiece },
  { key: "run", label: "Movimiento", icon: FaPersonRunning },
  { key: "gym", label: "Entrenamiento", icon: FaDumbbell },
  { key: "spa", label: "Bienestar", icon: FaSpa },
  { key: "leaf", label: "Natural", icon: FaLeaf },
  { key: "music", label: "Música", icon: FaMusic },
  { key: "group", label: "Grupos", icon: FaUsers },
];

const BY_KEY = new Map(SPECIALITY_ICONS.map((item) => [item.key, item.icon]));

/** El ícono que se propone cuando nadie eligió uno. */
export const DEFAULT_SPECIALITY_ICON = "care";

/** Palabras del nombre que sugieren cada ícono, sin tildes y en minúscula. La primera que aparece gana. */
const HINTS: [RegExp, string][] = [
  [/psicoped|aprendiz|pedagog/, "book"],
  [/psiquiat/, "stethoscope"],
  [/psico|mental|terapia cognitiva|psicoanal/, "brain"],
  [/nutri|aliment|diet/, "apple"],
  [/fono|audio|lenguaje|habla/, "ear"],
  [/odonto|dent|ortodon/, "tooth"],
  [/trauma|osteo|ortoped|reuma/, "bone"],
  [/oftalm|optic|vision/, "eye"],
  [/obstet|neonat|lactan|embaraz/, "baby"],
  [/pediat|infant|ninos/, "child"],
  [/estimul|motric|ocupacional|desarrollo/, "puzzle"],
  [/kines|fisio|rehab|deport/, "run"],
  [/entren|pilates|funcional|gimnas/, "gym"],
  [/cardio/, "heart"],
  [/masaj|estetic|cosmet|yoga|medit|spa/, "spa"],
  [/music/, "music"],
  [/grup|famil|pareja/, "group"],
  [/clinic|medic|general|neuro|dermat|gineco|endocr|gastro|urolog/, "doctor"],
];

function plain(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** El ícono que mejor le queda a una especialidad por su nombre. */
export function suggestIcon(name: string): string {
  const text = plain(name);
  return HINTS.find(([pattern]) => pattern.test(text))?.[1] ?? DEFAULT_SPECIALITY_ICON;
}

/** El componente de un ícono por su clave, o el genérico. */
export function iconOf(key: string | null | undefined): IconType {
  return (key && BY_KEY.get(key)) || BY_KEY.get(DEFAULT_SPECIALITY_ICON)!;
}

/** Los tintes de la portada, en orden, para repartir entre las especialidades. */
export const SPECIALITY_TINTS = ["#2f6f6b", "#5d7f3f", "#9a5561", "#a8763a", "#6b5a8e"];
