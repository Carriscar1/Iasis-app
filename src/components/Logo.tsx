import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

// Marca IASIS: coração com traço de batimento (ECG).
// Mesmo desenho do site — vetorial, nítido em qualquer tamanho.
export function LogoMark({ size = 72 }: { size?: number }) {
  return (
    <Svg width={size} height={size * (116 / 120)} viewBox="0 0 120 116" fill="none">
      <Defs>
        <LinearGradient id="iasisHeart" x1="60" y1="12" x2="60" y2="104" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#AFD0EE" />
          <Stop offset="1" stopColor="#5B93CF" />
        </LinearGradient>
      </Defs>
      <Path
        d="M60 102C26 76 12 57 12 39 12 25 23 15 35 15 45 15 54 21 60 31 66 21 75 15 85 15 97 15 108 25 108 39 108 57 94 76 60 102Z"
        fill="url(#iasisHeart)"
      />
      <Path
        d="M27 60H49l5-11 7 24 8-31 6 18h13"
        stroke="#101d33"
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
