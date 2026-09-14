import { ImageSourcePropType } from "react-native";

/**
 * El consultorio en fotos y datos, para lo que ve el paciente al entrar.
 *
 * Son las mismas fotos de la portada de la página, en los mismos tamaños que usa la página
 * en el celular (960 px las horizontales, 640 las verticales). Van adentro de la app y no
 * se piden al servidor: son pocas, no cambian y así se ven apenas se abre, con o sin señal.
 */

export interface PlacePhoto {
  source: ImageSourcePropType;
  /** Qué se ve. Solo para el lector de pantalla: en pantalla las fotos van sin epígrafe. */
  caption: string;
}

/** Horizontales, para la franja de arriba: pasan de a una, despacio. */
export const BAND_PHOTOS: PlacePhoto[] = [
  { source: require("../../assets/images/lugar/sala-jardin.webp"), caption: "Sala de espera con vista al jardín" },
  { source: require("../../assets/images/lugar/sala-vidriada.webp"), caption: "Sala de espera bajo el techo vidriado" },
  { source: require("../../assets/images/lugar/recepcion-escalera.webp"), caption: "Recepción y escalera" },
  { source: require("../../assets/images/lugar/salida-jardin.webp"), caption: "Salida al jardín" },
  { source: require("../../assets/images/lugar/sala-desde-arriba.webp"), caption: "Sala de espera vista desde el primer piso" },
];

/** Verticales, para la galería: en el orden en que se recorre el lugar. */
export const GALLERY_PHOTOS: PlacePhoto[] = [
  { source: require("../../assets/images/lugar/pasillo-mural.webp"), caption: "La entrada" },
  { source: require("../../assets/images/lugar/recepcion.webp"), caption: "La recepción" },
  { source: require("../../assets/images/lugar/consultorio.webp"), caption: "Un consultorio" },
  { source: require("../../assets/images/lugar/patio-vidriado.webp"), caption: "La sala bajo el techo vidriado" },
  { source: require("../../assets/images/lugar/jardin-noche.webp"), caption: "El jardín" },
];

/**
 * Las especialidades con su ícono y su color, los mismos de la portada de la página. El
 * nombre tiene que coincidir con SPECIALITIES, que es lo que usa el pedido de turno.
 */
export const SPECIALITY_TILES = [
  { name: "Psicopedagogía", icon: "book-open-reader", tint: "#5d7f3f" },
  { name: "Psicología", icon: "brain", tint: "#2f6f6b" },
  { name: "Nutrición", icon: "apple-whole", tint: "#a8763a" },
  { name: "Fonoaudiología", icon: "ear-listen", tint: "#6b5a8e" },
] as const;

/** El recorrido hasta la puerta, en la aplicación de mapas del teléfono. */
export const DIRECTIONS_URL = "https://www.google.com/maps/dir/?api=1&destination=9+de+Julio+3672,+Rosario,+Santa+Fe";
