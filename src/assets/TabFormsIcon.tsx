import React from "react";
import Svg, { Path } from "react-native-svg";

type Props = {
  size?: number;
  color?: string;
};

export default function TabFormsIcon({ size = 22, color = "#000" }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 3H14L18 7V20C18 21.1046 17.1046 22 16 22H7C5.89543 22 5 21.1046 5 20V5C5 3.89543 5.89543 3 7 3Z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M9 12H15" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M9 16H15" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M14 3V7H18" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}
