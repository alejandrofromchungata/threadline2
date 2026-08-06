import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Garment from './Garment';
import { T, STATUS } from '../theme';

const abbr = (v = '') => v.slice(0, 3).toUpperCase();

export default function ItemCard({ item, onPress, width }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${STATUS[item.status]?.label || ''}`}
      style={({ pressed }) => [c.card, { width }, pressed && { opacity: 0.85 }]}
    >
      <View style={[c.dot, { backgroundColor: STATUS[item.status]?.dot || T.seamDark }]} />
      <View style={c.art}>
        {item.imageUri ? (
          <Image
            source={{ uri: item.imageUri }}
            style={c.image}
            contentFit="contain"
            transition={120}
            cachePolicy="memory-disk"
          />
        ) : (
          <Garment category={item.category} color={item.color} size={92} />
        )}
      </View>
      <Text style={c.name} numberOfLines={2}>{item.name}</Text>
      <View style={c.label}>
        <Text style={c.labelText}>{abbr(item.material) || '—'}</Text>
        <Text style={c.labelText}>
          {(item.seasons || []).map((x) => x[0].toUpperCase()).join('') || '—'}
        </Text>
        <Text style={c.labelText}>F{item.formality}</Text>
        <Text style={c.labelText}>×{item.wears}</Text>
      </View>
    </Pressable>
  );
}

const c = StyleSheet.create({
  card: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.seam,
    borderRadius: 3, paddingTop: 10, paddingHorizontal: 10, overflow: 'hidden',
  },
  art: { height: 100, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: 100 },
  name: { fontSize: 13, fontWeight: '500', lineHeight: 17, marginTop: 8, marginBottom: 8, minHeight: 34, color: T.ink },
  label: {
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderColor: T.seam, borderStyle: 'dashed',
    marginHorizontal: -10, paddingHorizontal: 10, paddingVertical: 7,
    backgroundColor: 'rgba(207,202,187,0.16)',
  },
  labelText: { fontSize: 9, letterSpacing: 0.6, color: T.muted },
  dot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, zIndex: 2 },
});
