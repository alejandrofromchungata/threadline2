import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../ThemeContext';

/**
 * Stepped 1–5 control. Deliberately not a drag slider: discrete taps are
 * more accurate on a phone and need no extra native dependency.
 */
export default function Slider({ min = 1, max = 5, value, onChange, labels }) {
  const { T } = useTheme();
  const sl = useMemo(() => makeStyles(T), [T]);
  const steps = [];
  for (let v = min; v <= max; v++) steps.push(v);
  return (
    <View style={sl.row}>
      {steps.map((v) => {
        const on = v <= value;
        return (
          <Pressable
            key={v}
            onPress={() => onChange(v)}
            accessibilityRole="adjustable"
            accessibilityLabel={labels ? labels[v - min] : `Level ${v}`}
            style={[sl.step, on && sl.stepOn, v === value && sl.stepCurrent]}
          >
            <Text style={[sl.text, on && { color: '#fff' }]}>{labels ? labels[v - min] : v}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (T) => StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  step: {
    flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 2,
    borderWidth: 1, borderColor: T.seam, backgroundColor: T.card,
  },
  stepOn: { backgroundColor: T.indigo, borderColor: T.indigo },
  stepCurrent: { borderColor: T.ink },
  text: { fontSize: 13, color: T.ink, fontWeight: '500' },
});
