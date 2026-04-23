import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import { colors } from "../theme";


type WaveGlyphProps = {
  active?: boolean;
  color?: string;
  accentColor?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
};


const BAR_HEIGHTS = [18, 34, 24, 48, 70, 92, 64, 84, 56, 36, 26, 18];


export function WaveGlyph({
  active = false,
  color = colors.primarySoft,
  accentColor = colors.accent,
  height = 96,
  style,
}: WaveGlyphProps) {
  const scale = height / 96;

  return (
    <View style={[styles.container, { height }, style]}>
      {BAR_HEIGHTS.map((barHeight, index) => {
        const isAccent = index === 4 || index === 7 || index === 8;

        return (
          <View
            key={`${barHeight}-${index}`}
            style={[
              styles.bar,
              {
                height: Math.max(10, barHeight * scale),
                backgroundColor: isAccent ? accentColor : color,
                opacity: active ? 1 : 0.72,
              },
            ]}
          />
        );
      })}
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
  },
  bar: {
    width: 10,
    borderRadius: 999,
  },
});
