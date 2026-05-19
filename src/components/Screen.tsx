import React from 'react';
import { View, StyleSheet, ScrollView, ViewStyle, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors, spacing } from '@/theme';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: ViewStyle;
  centered?: boolean;
  keyboardAvoiding?: boolean;
  keyboardVerticalOffset?: number;
  /**
   * Si true, le Screen n'applique pas de backgroundColor — utile quand
   * un composant en arrière-plan (ImageBackground, gradient, etc.) doit
   * être visible sur toute la surface, y compris dans les zones safe-area.
   */
  transparent?: boolean;
}

export function Screen({
  children,
  scroll = false,
  padded = true,
  style,
  centered = false,
  keyboardAvoiding = false,
  keyboardVerticalOffset = 0,
  transparent = false,
}: ScreenProps) {
  const containerStyle = [
    transparent ? styles.containerTransparent : styles.container,
    padded && styles.padded,
    centered && styles.centered,
    style,
  ];

  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={containerStyle}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={containerStyle}>{children}</View>
  );

  // KeyboardAvoidingView sur les deux plateformes :
  //  - iOS : behavior="padding" — pousse le contenu via padding bas
  //  - Android : behavior="height" — redimensionne le wrapper
  // On compte plus sur adjustResize seul car il a des bugs sur certains
  // devices (notamment quand combiné à SafeAreaView + tab navigator).
  const wrapped = keyboardAvoiding ? (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {inner}
    </KeyboardAvoidingView>
  ) : (
    inner
  );

  return (
    <SafeAreaView style={transparent ? styles.safeTransparent : styles.safe}>
      <StatusBar style="light" />
      {wrapped}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safeTransparent: {
    flex: 1,
  },
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    backgroundColor: colors.bg,
  },
  containerTransparent: {
    flexGrow: 1,
  },
  padded: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
