import { Text as RNText, TextProps } from "react-native";
import { MAX_FONT_SCALE, type as typeScale } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";

type Variant = keyof typeof typeScale;
type Tone = "default" | "muted" | "green" | "danger" | "warn" | "cream" | "onGreen";

interface Props extends TextProps {
  variant?: Variant;
  tone?: Tone;
  /**
   * Texto que vive dentro de una caja de tamaño fijo (botones, etiquetas, chips). Ahí el
   * escalado tipográfico se topea, porque si crece sin límite rompe el recuadro. El
   * texto de contenido no lleva esto: tiene que poder crecer todo lo que la persona
   * necesite.
   */
  chrome?: boolean;
}

/**
 * Todo el texto de la app pasa por acá. Es lo que impide que aparezca un fontSize suelto
 * en una pantalla y que a los tres meses haya cinco grises distintos.
 */
export function AppText({ variant = "body", tone = "default", chrome, style, ...rest }: Props) {
  const { colors } = useTheme();

  const color = {
    default: colors.text,
    muted: colors.muted,
    green: colors.greenDark,
    danger: colors.danger,
    warn: colors.warn,
    cream: colors.cream,
    onGreen: colors.onGreen,
  }[tone];

  return (
    <RNText
      maxFontSizeMultiplier={chrome ? MAX_FONT_SCALE : undefined}
      style={[typeScale[variant], { color }, style]}
      {...rest}
    />
  );
}
