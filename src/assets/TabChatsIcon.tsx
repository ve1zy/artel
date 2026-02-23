import React from "react";
import Svg, { Path } from "react-native-svg";

type Props = {
  size?: number;
  color?: string;
};

export default function TabChatsIcon({ size = 22, color = "#000" }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6.5 6H17.5C18.8807 6 20 7.11929 20 8.5V14.5C20 15.8807 18.8807 17 17.5 17H12L8.3 19.775C7.64074 20.2694 6.7 19.7987 6.7 18.975V17H6.5C5.11929 17 4 15.8807 4 14.5V8.5C4 7.11929 5.11929 6 6.5 6Z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M8 10H16" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8 13H13" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
