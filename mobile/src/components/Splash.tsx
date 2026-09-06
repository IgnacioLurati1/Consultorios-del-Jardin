import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LEAF_EMPTY, leafColorsFor } from "../theme/leaf";
import { space } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";
import { FillingLeaf } from "./Leaf";

/**
 * La marca tiene las letras negras, que sobre el verde oscuro no se leen. Al lado vive la
 * misma imagen con las letras claras; las hojas son las mismas en las dos.
 */
const wordmark = {
  light: require("../../assets/images/wordmark.png"),
  dark: require("../../assets/images/wordmark-dark.png"),
};

/** Lo bastante grande para sostener sola la pantalla, sin llenarla. */
const LEAF_SIZE = 138;

/**
 * Cómo está parada antes de soltarse.
 *
 * Bien inclinada y no casi derecha: derecha parece pegada a la pantalla, y así parece
 * colgando de algo que ya no se ve. Es además de donde arranca el giro de la caída, que
 * por eso no empieza de cero.
 */
const INCLINACION = "-33deg";

const LLENADO_MS = 1400;
/**
 * El rato en que la hoja queda llena y quieta antes de soltarse.
 *
 * Es la única parte de la animación que no hace nada, y por eso hay que ponerla a mano:
 * si el llenado termina y la caída empieza en el mismo cuadro, el color recién completo
 * no se llega a ver. Acá no se mece: quieta es lo que la deja mirar.
 */
const CONTEMPLA_MS = 650;
const MARCA_MS = 300;
const SALIDA_MS = 1200;

/**
 * Lo que dura como mínimo, aunque la app ya esté lista.
 *
 * Es exactamente lo que dura el gesto: llenarse, sacar la marca de abajo, y caer. Si la
 * sesión tarda más, la hoja espera meciéndose y recién ahí cae; el piso es para que en un
 * teléfono rápido la animación no se vea por la mitad.
 */
const MINIMO_MS = LLENADO_MS + CONTEMPLA_MS + MARCA_MS + SALIDA_MS;

/** Por dónde se va. Se sortea al abrir, así la app no arranca siempre igual. */
type Salida = "caida" | "rulo";

interface Props {
  /** La fuente y la sesión ya están. */
  ready: boolean;
  /** Terminó de irse: el que la puso ya puede sacarla del árbol. */
  onDone: () => void;
  /** La primera vez que quedó dibujada. Sirve para bajar la pantalla nativa recién ahí. */
  onShown?: () => void;
}

/**
 * Lo primero que se ve al abrir.
 *
 * Una hoja apagada que se llena de color mientras la app carga, y que cuando termina se
 * suelta. El color es el de la estación en la que estemos, así que la app no se ve igual
 * en marzo que en octubre; el invierno es una perenne y no una hoja seca, porque un
 * consultorio abierto todo el año no se cuenta con algo que se murió.
 *
 * Se va de dos maneras, sorteadas al abrir: cayendo con el vaivén de algo que el aire
 * frena, o dando una vuelta y saliéndose por la derecha. El telón se corre para el mismo
 * lado que se fue la hoja —hacia abajo pierde alto, hacia la derecha pierde ancho— así lo
 * que aparece atrás parece destapado por ella y no por una transición cualquiera.
 *
 * La marca de abajo se va primero, antes de que la hoja llegue a esa altura: verla
 * atravesada por una hoja que cae sería un choque, no una animación.
 */
export function Splash({ ready, onDone, onShown }: Props) {
  const { colors, dark } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [salida] = useState<Salida>(() => (Math.random() < 0.5 ? "caida" : "rulo"));
  const tinta = useRef(leafColorsFor(new Date())).current;

  /* El llenado mueve una propiedad del SVG y la escala mueve una transformación, y esos
     dos caminos no se pueden mezclar en un mismo valor animado: van separados. */
  const llena = useRef(new Animated.Value(0)).current;
  const crece = useRef(new Animated.Value(0)).current;
  const mece = useRef(new Animated.Value(0)).current;
  const vuela = useRef(new Animated.Value(0)).current;
  const marca = useRef(new Animated.Value(1)).current;
  const telon = useRef(new Animated.Value(0)).current;

  const [llena100, setLlena100] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(llena, {
        toValue: 1,
        duration: LLENADO_MS,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: false,
      }),
      Animated.timing(crece, {
        toValue: 1,
        duration: LLENADO_MS,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    ]).start();

    // El rato de contemplarla va acá y no como un `delay` en la salida: si la sesión
    // tarda, la hoja ya estuvo quieta de sobra y no hay nada que esperar de nuevo.
    const reloj = setTimeout(() => setLlena100(true), LLENADO_MS + CONTEMPLA_MS);
    return () => clearTimeout(reloj);
  }, [llena, crece]);

  // Mientras haya algo que esperar, la hoja se mece. Una pantalla quieta es una app colgada.
  useEffect(() => {
    if (!llena100 || ready) return;

    const ciclo = Animated.loop(
      Animated.sequence([
        Animated.timing(mece, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(mece, { toValue: -1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );

    ciclo.start();
    return () => ciclo.stop();
  }, [llena100, ready, mece]);

  useEffect(() => {
    if (!llena100 || !ready) return;

    Animated.sequence([
      // Primero se va la marca. Recién cuando no está empieza a moverse la hoja.
      Animated.timing(marca, { toValue: 0, duration: MARCA_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(telon, {
          toValue: 1,
          duration: SALIDA_MS,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        // Lineal a propósito: la forma de la caída la dan los tramos de más abajo, no la
        // curva. Con una curva encima, el vaivén se deforma.
        Animated.sequence([
          Animated.delay(170),
          Animated.timing(vuela, { toValue: 1, duration: SALIDA_MS - 170, easing: Easing.linear, useNativeDriver: true }),
        ]),
      ]),
    ]).start(({ finished }) => {
      if (finished) onDone();
    });
  }, [llena100, ready, marca, telon, vuela, onDone]);

  /* ---------------- cómo se mueve la hoja ---------------- */

  const cayendo = salida === "caida";

  const vuelo = cayendo
    ? {
        // Arranca despacio y acelera, con el aire corriéndola de un lado al otro.
        translateY: vuela.interpolate({ inputRange: [0, 0.25, 0.55, 1], outputRange: [0, height * 0.09, height * 0.36, height * 0.95] }),
        translateX: vuela.interpolate({ inputRange: [0, 0.25, 0.55, 0.8, 1], outputRange: [0, -24, 20, -14, 6] }),
        rotate: vuela.interpolate({
          inputRange: [0, 0.25, 0.55, 0.8, 1],
          outputRange: [INCLINACION, "4deg", "-36deg", "8deg", "-21deg"],
        }),
        opacity: vuela.interpolate({ inputRange: [0, 0.78, 1], outputRange: [1, 1, 0] }),
      }
    : {
        // Sube un poco antes de irse, que es lo que hace que el rulo se lea como un rulo.
        translateY: vuela.interpolate({ inputRange: [0, 0.3, 0.65, 1], outputRange: [0, -34, 4, 44] }),
        translateX: vuela.interpolate({ inputRange: [0, 0.3, 0.65, 1], outputRange: [0, 24, width * 0.34, width * 0.95] }),
        rotate: vuela.interpolate({ inputRange: [0, 1], outputRange: [INCLINACION, "327deg"] }),
        opacity: vuela.interpolate({ inputRange: [0, 0.82, 1], outputRange: [1, 1, 0] }),
      };

  /* ---------------- cómo se corre el telón ----------------
     Se escala desde el centro, así que hay que empujarlo de vuelta la mitad de lo que se
     encogió para que el borde de abajo (o el de la derecha) se quede donde está. */
  const encoge = telon.interpolate({ inputRange: [0, 1], outputRange: [1, 0.0001] });
  const empuja = telon.interpolate({ inputRange: [0, 1], outputRange: [0, (cayendo ? height : width) / 2] });

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={onShown}
      style={[StyleSheet.absoluteFill, styles.pantalla]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: dark ? colors.ink : colors.bg,
            transform: cayendo
              ? [{ translateY: empuja }, { scaleY: encoge }]
              : [{ translateX: empuja }, { scaleX: encoge }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.marca,
          {
            bottom: insets.bottom + space.xxl,
            opacity: marca,
            transform: [{ translateY: marca.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          },
        ]}
      >
        <Image
          source={dark ? wordmark.dark : wordmark.light}
          style={styles.marcaImagen}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
      </Animated.View>

      {/* La traslación va acá afuera y el giro adentro: si el giro fuera acá, la franja
          que llena la hoja giraría con ella y el color subiría en diagonal. */}
      <Animated.View
        style={{
          opacity: vuelo.opacity,
          transform: [{ translateX: vuelo.translateX }, { translateY: vuelo.translateY }],
        }}
      >
        <FillingLeaf
          size={LEAF_SIZE}
          empty={LEAF_EMPTY}
          full={tinta}
          progress={llena}
          leafStyle={{
            transform: [
              { rotate: vuelo.rotate },
              { rotate: mece.interpolate({ inputRange: [-1, 1], outputRange: ["-3deg", "3deg"] }) },
              { scale: crece.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
            ],
          }}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pantalla: { alignItems: "center", justifyContent: "center", pointerEvents: "none" },
  marca: { position: "absolute", alignItems: "center" },
  marcaImagen: { width: 128, height: 72 },
});
