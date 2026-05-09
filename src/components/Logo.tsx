import React from 'react';
import { Image, ImageStyle } from 'react-native';

interface LogoProps {
  size?: number;
  style?: ImageStyle;
}

const SOURCE = require('../../assets/logo-mark.png');

/**
 * Trimya brand mark — uses the official PNG asset.
 */
export function Logo({ size = 96, style }: LogoProps) {
  return (
    <Image
      source={SOURCE}
      style={[{ width: size, height: size, resizeMode: 'contain' }, style]}
    />
  );
}
