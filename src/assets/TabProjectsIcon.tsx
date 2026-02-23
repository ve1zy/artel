import React from "react";
import Svg, { Path } from "react-native-svg";

type Props = {
  size?: number;
  color?: string;
};

export default function TabProjectsIcon({ size = 22, color = "#000" }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 7.5C4 6.11929 5.11929 5 6.5 5H9.3C9.63137 5 9.94916 5.1317 10.1836 5.36612L11.3172 6.49972C11.5516 6.73414 11.8694 6.86584 12.2008 6.86584H17.5C18.8807 6.86584 20 7.98513 20 9.36584V17.5C20 18.8807 18.8807 20 17.5 20H6.5C5.11929 20 4 18.8807 4 17.5V7.5Z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M7 12H17" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
