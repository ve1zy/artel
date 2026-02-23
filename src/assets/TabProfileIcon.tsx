import React from "react";
import Svg, { Path, Circle } from "react-native-svg";

type Props = {
  size?: number;
  color?: string;
};

export default function TabProfileIcon({ size = 22, color = "#000" }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="3" stroke={color} strokeWidth={2} />
      <Path
        d="M5.5 20C6.6 16.9 9.1 15 12 15C14.9 15 17.4 16.9 18.5 20"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}
