import { ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SCREEN_PADDING, space } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";

interface Props {
  children: ReactNode;
  /** Sin scroll para pantallas de una sola pantalla (formularios cortos, estados vacíos). */
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Quita el padding lateral: lo usan las listas que dibujan sus propias filas al borde. */
  flush?: boolean;
  /** Espacio extra abajo, para dejar respirar una barra de acción fija. */
  bottomSpace?: number;
  style?: ViewStyle;
}

/**
 * El marco de toda pantalla: fondo, padding lateral y el aire de abajo que hace falta
 * para que el último elemento no quede tapado por la barra de gestos del teléfono.
 *
 * El aire de arriba no se toca: cuando hay encabezado de navegación, ese inset ya lo
 * resolvió el navegador.
 */
export function Screen({ children, scroll = true, onRefresh, refreshing = false, flush, bottomSpace = 0, style }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const padding: ViewStyle = {
    paddingHorizontal: flush ? 0 : SCREEN_PADDING,
    paddingBottom: insets.bottom + space.xxl + bottomSpace,
  };

  if (!scroll) {
    return <View style={[styles.fill, { backgroundColor: colors.bg }, padding, style]}>{children}</View>;
  }

  return (
    <ScrollView
      style={[styles.fill, { backgroundColor: colors.bg }]}
      contentContainerStyle={[padding, style]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} colors={[colors.green]} /> : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
