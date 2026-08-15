/**
 * Custom subpocket icon based on the user-provided SVG
 * A stylized box/container icon for subpockets with brand color support
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface SubPocketIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function SubPocketIcon({ size = 24, color = 'currentColor', strokeWidth = 2 }: SubPocketIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Path d="M0 0h48v48H0z" fill="none" />
      <Path 
        stroke={color} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={strokeWidth}
        d="M39.874 36.398c0 3.935-4.223 7.102-9.47 7.102H17.596c-5.246 0-9.469-3.167-9.469-7.102V16.141a2.36 2.36 0 0 1 2.367-2.367h27.014a2.36 2.36 0 0 1 2.367 2.367z" 
      />
      <Path 
        stroke={color} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={strokeWidth}
        d="m8.267 24.882l14.07 3.77a6.53 6.53 0 0 0 3.326 0l14.07-3.77m-28.16-11.109l1.373-5.543h0l22.383 5.545" 
      />
      <Path 
        stroke={color} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={strokeWidth}
        d="M15.812 8.941L17.957 4.5h0l19.2 9.274" 
      />
    </Svg>
  );
}
