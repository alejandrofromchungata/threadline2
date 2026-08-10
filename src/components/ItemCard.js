import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Garment from './Garment';
import { T, FONTS, STATUS, formalityDots } from '../theme';

const abbr = (v = '') => {
  if (!v) return '—';
  const short = v.split(' ').map((w) => w[0]).join('').toUpperCase();
  return v.length <= 10 ? v.replace(/^\w/, (c) => c.toUpperCase()) : short;
};

export default function ItemCard({ item, onPress, width }) {
  const [broken, setBroken] = useState(false);
  const showPhoto = item.imageUri && !broken;
  const status = STATUS[item.status] || STATUS.clean;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${status.label}`}
      style={({ pressed }) => [c.card, { width }, pressed && { opacity: 0.85 }]}
    >
      <View style={c.art}>
        {showPhoto ? (
          <Image
            source={{ uri: item.imageUri }}
            style={c.image}
            contentFit="contain"
            transition={120}
            cachePolicy="memory-disk"
            onError={() => setBroken(true)}
          />
        ) : (
          <Garment category={item.category} color={item.color} size={84} />
        )}
        <View style={c.statusBadge}>
          <View style={[c.statusDot, { backgroundColor: status.dot }]} />
          <Text style={c.statusText}>{status.label}</Text>
        </View>
      </View>

      <View style={c.titleBlock}>
        <Text style={c.name} numberOfLines={1}>{item.name}</Text>
      </View>

      <View style={c.careStrip}>
        <Text style={c.careText} numberOfLines={1}>{abbr(item.material)}</Text>
        <Text style={c.careText}>
          {(item.seasons || []).map((x) => x[0].toUpperCase()).join('/') || '—'}
        </Text>
        <Text style={c.dots}>{formalityDots(item.formality)}</Text>
        <Text style={c.wears}>{item.wears}w</Text>
      </View>
    </Pressable>
  );
}

const c = StyleSheet.create({
  card: {
    backgroundColor: T.card, borderRadius: 8, overflow: 'hidden',
    borderWidth: 1, borderColor: T.seam,
  },
  art: {
    height: 130, alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.paper, position: 'relative',
  },
  image: { width: '100%', height: 130 },
  statusBadge: {
    position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: T.card, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: FONTS.mono, fontSize: 8, color: T.muted, letterSpacing: 0.3 },
  titleBlock: {
    paddingHorizontal: 12, paddingVertical: 12,
    borderTopWidth: 1, borderColor: T.seam,
  },
  name: { fontFamily: FONTS.display, fontSize: 17, color: T.ink },
  careStrip: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderColor: T.seam, backgroundColor: T.careStrip,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  careText: { fontFamily: FONTS.mono, fontSize: 9, color: T.muted, flexShrink: 1 },
  dots: { fontFamily: FONTS.monoSemi, fontSize: 9, color: T.indigo },
  wears: { fontFamily: FONTS.mono, fontSize: 9, color: T.ink },
});
