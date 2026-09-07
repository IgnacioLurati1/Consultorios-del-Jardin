/**
 * Cómo se lee una respuesta del asistente.
 *
 * Es el mismo criterio que la web (frontend/src/components/chatAssistant/answerFormat.ts).
 * Están escritos dos veces porque son dos proyectos separados, pero tienen que decir lo
 * mismo: la misma respuesta no puede leerse ordenada en la computadora y como un volcado
 * en el teléfono.
 *
 * El asistente contesta en texto plano, y eso no va a cambiar: es lo que sabe hacer bien
 * un modelo y lo que no se rompe cuando contesta algo que nadie previó. Lo que sí se
 * puede hacer es reconocer las formas que repite —una lista de turnos, un renglón por
 * cosa, los datos separados por puntos— y dibujarlas como lo que son en vez de dejarlas
 * como un párrafo largo con guiones adentro.
 *
 * Es todo de este lado a propósito. El backend sigue mandando una cadena, el prompt sigue
 * pidiendo texto plano, y si algún día el modelo contesta de una forma que acá no se
 * reconoce, se ve el texto tal cual y no se rompe nada. Lo que se gana es que la pregunta
 * más común —"¿qué turnos tengo?"— deje de leerse como un volcado.
 */

/** El estado de un turno, tal como el asistente lo escribe al final del renglón. */
const ESTADOS: Record<string, "green" | "amber" | "red" | "grey"> = {
  confirmado: "green",
  confirmada: "green",
  aceptado: "green",
  libre: "green",
  disponible: "green",
  pendiente: "amber",
  "pendiente de confirmación": "amber",
  "esperando que lo confirmes": "amber",
  cancelado: "grey",
  cancelada: "grey",
  asistió: "grey",
  asistio: "grey",
  ocupado: "grey",
  "no vino": "red",
  rechazado: "red",
  ausente: "red",
};

export type Tone = "green" | "amber" | "red" | "grey";

export interface AnswerItem {
  /** El número del turno, que es con lo que la persona lo pide después. */
  number: number | null;
  /** Lo primero que dice el renglón, que es de lo que habla. */
  title: string;
  /** El resto de los datos, en el orden en que venían. */
  meta: string[];
  /** El estado, si el renglón terminaba en uno. */
  state: { label: string; tone: Tone } | null;
}

export type AnswerBlock = { kind: "text"; text: string } | { kind: "list"; items: AnswerItem[] };

/**
 * Saca las marcas de markdown que el modelo escribe igual.
 *
 * El prompt le pide texto plano porque la ventana no interpreta markdown, y casi siempre
 * hace caso. Casi: cuando se le escapa un par de asteriscos, lo que se veía eran los
 * asteriscos. Se van acá y no se convierten en negrita, porque el énfasis lo pone el
 * dibujo del renglón y no el modelo.
 */
function limpiar(line: string): string {
  return line
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/^#{1,6}\s+/, "")
    .trim();
}

/** Un renglón de lista, con guion, viñeta o asterisco adelante. */
const VINETA = /^[-–—•*]\s+(.*)$/;

/**
 * Con qué separa el modelo los datos de un renglón.
 *
 * Se le pide el punto medio y casi siempre lo usa, pero también manda rayas o guiones
 * según cómo venga la conversación. Se aceptan todos: reconocer uno solo significaba que
 * media respuesta se dibujara linda y la otra media quedara como un renglón corrido, que
 * es peor que si no se reconociera ninguna.
 *
 * Todos van rodeados de espacios a propósito. Sin eso, un guion se llevaría puesto
 * "9 de Julio 3672" y una raya partiría cualquier palabra compuesta.
 */
const SEPARADOR = /\s+[·|–—]\s+|\s+-\s+/;

/**
 * El número del turno cuando abre el renglón.
 *
 * Se lo saca de adelante en vez de exigir que venga solo en su propio pedazo: el modelo
 * escribe tanto "Turno #12 · el lunes" como "Turno #12: el lunes", y en el segundo caso
 * el número y la fecha vienen pegados.
 */
const NUMERO = /^(?:turno\s*)?#\s*(\d+)\s*[:.\-–—]?\s*/i;

function leerEstado(texto: string): { label: string; tone: Tone } | null {
  const tone = ESTADOS[texto.toLowerCase()];
  return tone ? { label: texto, tone } : null;
}

function leerItem(contenido: string): AnswerItem {
  const partes = contenido.split(SEPARADOR).map((p) => p.trim()).filter(Boolean);

  let number: number | null = null;
  const conNumero = (partes[0] ?? "").match(NUMERO);

  // El número no se queda en el renglón: pasa a ser la etiqueta de la izquierda. Lo que
  // venía atrás —la fecha, casi siempre— hereda el lugar del título.
  if (conNumero) {
    number = Number(conNumero[1]);
    const resto = partes[0].slice(conNumero[0].length).trim();

    if (resto) partes[0] = resto;
    else partes.shift();
  }

  const estado = partes.length > 1 ? leerEstado(partes[partes.length - 1]) : null;
  if (estado) partes.pop();

  return {
    number,
    title: partes.shift() ?? "",
    meta: partes,
    state: estado,
  };
}

/**
 * Parte la respuesta en párrafos y listas.
 *
 * Los renglones sueltos se juntan en un solo bloque de texto para que el salto de línea
 * siga significando lo que significaba; los que empiezan con viñeta se agrupan en la
 * lista a la que pertenecen.
 */
export function readAnswer(answer: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  let texto: string[] = [];
  let lista: AnswerItem[] = [];

  function cerrarTexto() {
    const junto = texto.join("\n").trim();
    if (junto) blocks.push({ kind: "text", text: junto });
    texto = [];
  }

  function cerrarLista() {
    if (lista.length > 0) blocks.push({ kind: "list", items: lista });
    lista = [];
  }

  for (const raw of answer.split("\n")) {
    const line = limpiar(raw);
    const item = line.match(VINETA);

    if (item) {
      cerrarTexto();
      lista.push(leerItem(item[1]));
      continue;
    }

    cerrarLista();
    // Un renglón vacío adentro del texto se conserva; uno antes del primer párrafo, no.
    if (line || texto.length > 0) texto.push(line);
  }

  cerrarLista();
  cerrarTexto();

  return blocks;
}

/** Si vale la pena dibujarla o alcanza con el texto tal cual. */
export function hasStructure(blocks: AnswerBlock[]): boolean {
  return blocks.some((block) => block.kind === "list");
}
