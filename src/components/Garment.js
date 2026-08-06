import React from 'react';
import Svg, { Path, Ellipse } from 'react-native-svg';

/**
 * Placeholder mark for items added without a photo.
 * Real items render their cut-out PNG instead.
 */
export default function Garment({ category, color = '#8A8A8A', size = 90 }) {
  const shade = 'rgba(0,0,0,0.16)';
  const shapes = {
    tops: (
      <>
        <Path d="M30 20 L42 15 Q50 22 58 15 L70 20 L80 34 L69 41 L69 82 Q50 87 31 82 L31 41 L20 34 Z" fill={color} />
        <Path d="M31 41 L31 82 Q40 85 44 85 L44 41 Z" fill={shade} />
      </>
    ),
    innerwear: (
      <>
        <Path d="M35 18 Q42 26 50 26 Q58 26 65 18 L70 24 L68 82 Q50 87 32 82 L30 24 Z" fill={color} />
        <Path d="M32 24 L30 82 Q39 85 43 85 L43 24 Z" fill={shade} />
      </>
    ),
    outerwear: (
      <>
        <Path d="M28 20 L42 14 L58 14 L72 20 L82 38 L71 44 L71 86 Q50 90 29 86 L29 44 L18 38 Z" fill={color} />
        <Path d="M42 14 L50 34 L58 14 L58 88 L42 88 Z" fill={shade} opacity={0.55} />
      </>
    ),
    pants: (
      <>
        <Path d="M31 16 H69 L73 90 H57 L50 46 L43 90 H27 Z" fill={color} />
        <Path d="M31 16 H50 L50 46 L43 90 H27 Z" fill={shade} opacity={0.5} />
      </>
    ),
    dresses: (
      <>
        <Path d="M36 16 Q43 24 50 24 Q57 24 64 16 L70 22 L66 46 L78 90 Q50 96 22 90 L34 46 L30 22 Z" fill={color} />
        <Path d="M34 46 L22 90 Q34 93 41 94 L44 46 Z" fill={shade} opacity={0.5} />
      </>
    ),
    shoes: (
      <>
        <Path d="M18 68 Q20 44 34 44 Q42 44 46 54 Q54 64 74 66 Q86 68 86 78 L86 82 H18 Z" fill={color} />
        <Path d="M18 78 H86 V84 Q52 88 18 84 Z" fill={shade} />
      </>
    ),
    headwear: (
      <>
        <Path d="M24 62 Q24 26 50 26 Q76 26 76 62 Z" fill={color} />
        <Path d="M76 62 Q92 60 92 70 L20 70 Q20 60 24 62 Z" fill={shade} />
      </>
    ),
    accessories: (
      <>
        <Path d="M28 40 H72 L78 86 H22 Z" fill={color} />
        <Path d="M38 40 Q38 22 50 22 Q62 22 62 40" stroke={color} strokeWidth={5} fill="none" />
      </>
    ),
  };
  return (
    <Svg viewBox="0 0 100 100" width={size} height={size}>
      <Ellipse cx={50} cy={93} rx={26} ry={4} fill="rgba(26,28,32,0.10)" />
      {shapes[category] || shapes.tops}
    </Svg>
  );
}
