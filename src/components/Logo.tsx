import React from 'react';
import { Image, ImageStyle } from 'react-native';
import { isProApp } from '@/lib/appTarget';

interface LogoProps {
  size?: number;
  style?: ImageStyle;
  /**
   * Force une variante spécifique (debug, écran de sélection de rôle…).
   * Par défaut on utilise la variante qui correspond à la cible de build
   * détectée au runtime via `appTarget` (Constants.expoConfig.extra).
   */
  variant?: 'client' | 'pro';
}

// Les 2 variantes sont `require()`-ées au top-level pour que Metro les
// bundle statiquement — pas d'import dynamique côté web.
const CLIENT_SOURCE = require('../../assets/logo-mark.png');
const PRO_SOURCE = require('../../assets/logo-mark-pro.png');

/**
 * Logo Trimya — affiche automatiquement la variante client ou pro selon
 * la cible de build. La variante Pro porte un badge « PRO » intégré à
 * l'image, ce qui évite d'avoir à superposer un badge en JSX (et donc
 * reste cohérent partout : splash, header, écrans auth…).
 *
 * Pour forcer une variante (ex. écran marketing qui montre les deux côte
 * à côte), passer `variant="client"` ou `variant="pro"`.
 */
export function Logo({ size = 96, style, variant }: LogoProps) {
  const resolved = variant ?? (isProApp() ? 'pro' : 'client');
  const source = resolved === 'pro' ? PRO_SOURCE : CLIENT_SOURCE;
  return (
    <Image
      source={source}
      style={[{ width: size, height: size, resizeMode: 'contain' }, style]}
    />
  );
}
