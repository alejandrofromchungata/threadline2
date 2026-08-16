import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Garment from './Garment';
import { FONTS, getStatus, formalityDots } from '../theme';
import { useTheme } from '../ThemeContext';

const abbr = (v = '') => {
  if (!v) return '—';
  const short = v.split(' ').map((w) => w[0]).join('').toUpperCase();
  return v.length <= 10 ? v.replace(/^\w/, (c) => c.toUpperCase()) : short;
};

export default function ItemCard({ item, onPress, width }) {
  const { T } = useTheme();
  const c = useMemo(() => makeStyles(T), [T]);
  const [broken, setBroken] = useState(false);
  const showPhoto = item.imageUri && !broken;
  const status = getStatus(T)[item.status] || getStatus(T).clean;

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

const makeStyles = (T) => StyleSheet.create({
  card: {
    backgroundColor: T.card, borderRadius: 8, overflow: 'hidden',
    borderWidth: 1, borderColor: T.seam,
  },
  art: {
    // Figma: image-area is 173x160 inside a 173-wide card, so the art block
    // scales with card width rather than sitting at a fixed height.
    width: '100%', aspectRatio: 173 / 160,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.cardArt, position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  statusBadge: {
    position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: T.card, borderRadius: 100, paddingHorizontal: 4, paddingVertical: 4,
    borderWidth: 1, borderColor: T.seam,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: {
    fontFamily: FONTS.monoSemi, fontSize: 9, lineHeight: 12, color: T.ink,
    letterSpacing: 0, textTransform: 'lowercase',
  },
  titleBlock: {
    paddingHorizontal: 12, paddingVertical: 12,
    borderTopWidth: 1, borderColor: T.seam,
  },
  name: { fontFamily: FONTS.display, fontSize: 18, lineHeight: 24, color: T.ink },
  careStrip: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderColor: T.seam, backgroundColor: T.careStrip,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  careText: { fontFamily: FONTS.mono, fontSize: 10, color: T.muted, flexShrink: 1 },
  dots: { fontFamily: FONTS.monoSemi, fontSize: 10, color: T.indigo },
  wears: { fontFamily: FONTS.mono, fontSize: 10, color: T.ink },
});
