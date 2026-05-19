import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  ViewStyle,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing } from '@/theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
}

const IS_ANDROID = Platform.OS === 'android';

/**
 * Bouton principal de l'app.
 *
 * Pour la variante `primary` on a deux implémentations distinctes :
 *
 * - **iOS** → `LinearGradient` jaune → orange en fond, label superposé dans
 *   un `View pointerEvents="none"` au-dessus.
 *
 * - **Android** → MÊME LinearGradient (le dégradé est conservé !), mais on
 *   blinde le rendu du texte pour contourner le bug RN-Android où le `Text`
 *   devient invisible quand il partage une scène native avec un
 *   `LinearGradient` :
 *     · `collapsable={false}` sur les wrappers → empêche RN de les fusionner
 *       dans la View parent, ce qui casse le z-order de compositing.
 *     · `elevation: 1` sur le wrapper du label → force Android à le rendre
 *       sur un layer matériel SÉPARÉ, donc strictement au-dessus du gradient.
 *     · `includeFontPadding: false` → centrage propre du texte.
 *     · `backgroundColor: colors.primary` en fallback dans `base` → si pour
 *       une raison X le gradient ne monte pas, on a quand même un bouton
 *       orange lisible plutôt qu'un trou noir.
 *
 * Variantes `secondary` (surface + bordure) et `ghost` (transparent) :
 * identiques iOS/Android, aucun gradient impliqué donc aucun bug possible.
 */
export function Button(props: ButtonProps) {
  if (props.variant === 'secondary' || props.variant === 'ghost') {
    return <PlainButton {...props} />;
  }
  return <GradientPrimaryButton {...props} />;
}

// ─── Primary : gradient + label ───────────────────────────────

function GradientPrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  style,
  fullWidth = true,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      android_ripple={IS_ANDROID ? { color: 'rgba(0,0,0,0.15)' } : undefined}
      style={({ pressed }) => [
        styles.base,
        styles.primaryFallback,
        fullWidth && styles.full,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[styles.content, IS_ANDROID && styles.contentAndroid]}
        pointerEvents="none"
        collapsable={false}
      >
        {loading ? (
          <ActivityIndicator color={colors.black} />
        ) : (
          <Text
            style={[styles.label, styles.labelDark]}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

// ─── Secondary / Ghost : pas de gradient, commun aux 2 OS ─────

function PlainButton({
  label,
  onPress,
  variant = 'secondary',
  loading = false,
  disabled = false,
  style,
  fullWidth = true,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const textColor = variant === 'secondary' ? colors.text : colors.textMuted;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        fullWidth && styles.full,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    overflow: 'hidden',
  },
  full: {
    alignSelf: 'stretch',
    width: '100%',
  },
  // Fallback couleur si le gradient ne monte pas (Android edge case)
  primaryFallback: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Sur Android, on force le wrapper du label sur sa propre couche matérielle
  // pour le faire passer STRICTEMENT au-dessus de la LinearGradient native.
  contentAndroid: {
    elevation: 2,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
  label: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
    includeFontPadding: false,
  },
  labelDark: {
    color: colors.black,
  },
});
