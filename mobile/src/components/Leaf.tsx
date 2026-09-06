import { Animated, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { LEAF_BLADE, LEAF_BOX, LEAF_MIDRIB, LEAF_STEM, LEAF_VEINS, LeafColors } from "../theme/leaf";

/** La hoja quieta, de un solo color. */
export function Leaf({ size, colors }: { size: number; colors: LeafColors }) {
  const height = (size * LEAF_BOX.height) / LEAF_BOX.width;

  return (
    <Svg width={size} height={height} viewBox={`0 0 ${LEAF_BOX.width} ${LEAF_BOX.height}`}>
      <Path d={LEAF_STEM} stroke={colors.blade} strokeWidth={4} strokeLinecap="round" fill="none" />
      <Path d={LEAF_BLADE} fill={colors.blade} />
      <Path d={LEAF_MIDRIB} stroke={colors.veins} strokeWidth={2.6} strokeLinecap="round" fill="none" />
      {LEAF_VEINS.map((vein) => (
        <Path key={vein} d={vein} stroke={colors.veins} strokeWidth={1.9} strokeLinecap="round" fill="none" />
      ))}
    </Svg>
  );
}

type EstiloAnimado = React.ComponentProps<typeof Animated.View>["style"];

/**
 * La hoja llenándose de color, de abajo hacia arriba en la pantalla.
 *
 * Está dibujada dos veces, una encima de la otra y en la misma posición: abajo la
 * apagada, arriba la del color final. Lo que sube es una franja con `overflow: hidden`
 * pegada al piso, que va dejando ver la de color.
 *
 * La franja es una vista común y no un recorte de adentro del SVG. Eso resuelve dos cosas
 * a la vez. Una es el sentido: la franja no está girada, así que el frente sube derecho
 * contra la pantalla aunque la hoja esté inclinada. La otra es que no hay que animar un
 * atributo de SVG, que es lo que hay que dibujar distinto en cada plataforma; acá se anima
 * un alto, que es lo más común que hay.
 *
 * El escenario es cuadrado y del tamaño de la diagonal de la hoja: así la hoja entra
 * entera dentro de la franja gire lo que gire, incluida la vuelta completa del rulo.
 */
export function FillingLeaf({
  size,
  empty,
  full,
  progress,
  leafStyle,
}: {
  size: number;
  empty: LeafColors;
  full: LeafColors;
  /** De 0 (apagada) a 1 (llena). Mueve un alto, así que va por JavaScript. */
  progress: Animated.Value;
  /** El giro y la escala. Va igual en las dos copias, o no coincidirían. */
  leafStyle?: EstiloAnimado;
}) {
  const height = (size * LEAF_BOX.height) / LEAF_BOX.width;
  const lado = Math.ceil(Math.hypot(size, height));

  const franja = progress.interpolate({ inputRange: [0, 1], outputRange: [0, lado] });

  return (
    <View style={[styles.escenario, { width: lado, height: lado }]}>
      <Animated.View style={leafStyle}>
        <Leaf size={size} colors={empty} />
      </Animated.View>

      <Animated.View style={[styles.franja, { height: franja }]}>
        {/* Del alto del escenario y apoyada en el mismo piso, para que la hoja de color
            caiga justo encima de la apagada por más que la franja sea un hilo. */}
        <View style={[styles.dentro, { width: lado, height: lado }]}>
          <Animated.View style={leafStyle}>
            <Leaf size={size} colors={full} />
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  escenario: { alignItems: "center", justifyContent: "center" },
  franja: { position: "absolute", left: 0, right: 0, bottom: 0, overflow: "hidden" },
  dentro: { position: "absolute", left: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
});
