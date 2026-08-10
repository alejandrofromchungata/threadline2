import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TextInput, Pressable, StyleSheet, ScrollView, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Circle } from 'react-native-svg';
import ItemCard from '../components/ItemCard';
import { Chip, Button, Hint, Eyebrow, Heading } from '../components/ui';
import Garment from '../components/Garment';
import { listItems } from '../db';
import { T, FONTS, CATEGORIES } from '../theme';

const SORTS = [
  ['recent', 'added'],
  ['worn', 'most worn'],
  ['cpw', 'cost per wear'],
  ['name', 'a–z'],
];

function NeedleMark() {
  return (
    <Svg viewBox="0 0 24 24" width={22} height={22}>
      <Path d="M6 18l9-13" stroke={T.indigo} strokeWidth={2} strokeLinecap="round" />
      <Path d="M15 5l2 1-1 2" stroke={T.indigo} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={7} cy={17} r={2} stroke={T.indigo} strokeWidth={1.4} fill="none" />
    </Svg>
  );
}

function FilterIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={19} height={19}>
      <Path d="M4 6h16M7 12h10M10 18h4" stroke={T.ink} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function SearchIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={19} height={19}>
      <Circle cx={11} cy={11} r={7} stroke={T.ink} strokeWidth={1.8} fill="none" />
      <Path d="M21 21l-4.3-4.3" stroke={T.ink} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export default function ClosetScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [cat, setCat] = useState('all');
  const [sort, setSort] = useState('recent');
  const [showSort, setShowSort] = useState(false);
  const [loading, setLoading] = useState(true);
  const { width } = useWindowDimensions();

  const load = useCallback(async () => {
    const rows = await listItems();
    setItems(rows);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = items.filter((i) => {
      if (cat !== 'all' && i.category !== cat) return false;
      if (!needle) return true;
      return [i.name, i.brand, i.colorName, i.material, ...(i.tags || [])]
        .join(' ').toLowerCase().includes(needle);
    });
    if (sort === 'worn') list = [...list].sort((a, b) => b.wears - a.wears);
    if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'cpw') {
      list = [...list].sort(
        (a, b) => (a.price / Math.max(a.wears, 1)) - (b.price / Math.max(b.wears, 1))
      );
    }
    return list;
  }, [items, q, cat, sort]);

  const cardWidth = (Math.min(width, 620) - 40 - 16) / 2;

  return (
    <SafeAreaView style={cs.safe} edges={['top']}>
      <View style={cs.brandBar}>
        <View style={cs.brandLogo}>
          <NeedleMark />
          <Text style={cs.wordmark}>Threadline</Text>
        </View>
        <View style={cs.actionIcons}>
          <Pressable onPress={() => setShowSort((v) => !v)} hitSlop={8}><FilterIcon /></Pressable>
          <Pressable onPress={() => setShowSearch((v) => !v)} hitSlop={8}><SearchIcon /></Pressable>
        </View>
      </View>

      {showSearch && (
        <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search — try “wool” or “date night”"
            placeholderTextColor={T.muted}
            style={cs.search}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoFocus
          />
        </View>
      )}

      {showSort && (
        <View style={cs.sortRow}>
          <Eyebrow style={{ marginRight: 4 }}>Sort</Eyebrow>
          {SORTS.map(([k, l]) => (
            <Pressable key={k} onPress={() => setSort(k)} hitSlop={8}>
              <Text style={[cs.sortLink, sort === k && cs.sortOn]}>{l}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={cs.chipRow}
      >
        <Chip small label="All" active={cat === 'all'} onPress={() => setCat('all')} />
        {CATEGORIES.map((c) => (
          <Chip
            key={c}
            small
            label={c[0].toUpperCase() + c.slice(1)}
            active={cat === c}
            onPress={() => setCat(c)}
          />
        ))}
      </ScrollView>

      <View style={cs.divider} />

      <FlatList
        data={shown}
        keyExtractor={(i) => i.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 16, paddingHorizontal: 20 }}
        contentContainerStyle={{ gap: 16, paddingTop: 20, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <ItemCard
            item={item}
            width={cardWidth}
            onPress={() => navigation.navigate('ItemDetail', { id: item.id })}
          />
        )}
        ListEmptyComponent={
          loading ? null : (
            <View style={cs.empty}>
              <Garment category="tops" color={T.seamDark} size={72} />
              <Heading size={20} style={{ marginTop: 16, textAlign: 'center' }}>
                {items.length ? 'Nothing matches that.' : 'The closet is empty.'}
              </Heading>
              <Hint style={{ textAlign: 'center', marginTop: 6 }}>
                {items.length
                  ? 'Try a different search or category.'
                  : 'Photograph something you own, or paste a product link.'}
              </Hint>
              {!items.length && (
                <Button
                  title="Add a piece"
                  style={{ marginTop: 18, alignSelf: 'stretch' }}
                  onPress={() => navigation.navigate('AddItem')}
                />
              )}
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const cs = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.paper },
  brandBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  brandLogo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordmark: { fontFamily: FONTS.display, fontSize: 22, color: T.indigo },
  actionIcons: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  search: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.seam, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 12, fontFamily: FONTS.sans, fontSize: 15, color: T.ink,
  },
  sortRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingBottom: 10, flexWrap: 'wrap',
  },
  sortLink: { fontFamily: FONTS.sansMedium, fontSize: 12, color: T.muted },
  sortOn: { color: T.indigo, textDecorationLine: 'underline' },
  chipRow: { gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  divider: { height: 1, backgroundColor: T.seam },
  empty: { padding: 40, alignItems: 'center' },
});
