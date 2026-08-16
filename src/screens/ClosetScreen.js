import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TextInput, Pressable, StyleSheet, ScrollView, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { CircleX, SlidersHorizontal, Search } from 'lucide-react-native';
import ItemCard from '../components/ItemCard';
import { Chip, Button, Hint, Eyebrow, Heading } from '../components/ui';
import Garment from '../components/Garment';
import { listItems } from '../db';
import { FONTS, CATEGORIES } from '../theme';
import { useTheme } from '../ThemeContext';

const SORTS = [
  ['recent', 'added'],
  ['worn', 'most worn'],
  ['cpw', 'cost per wear'],
  ['name', 'a–z'],
];

// Figma draws these with Lucide: circle-x for the wordmark, sliders-horizontal
// for sort, search for the filter field.
function NeedleMark() {
  const { T } = useTheme();
  return <CircleX size={24} color={T.indigo} strokeWidth={2} />;
}

function FilterIcon() {
  const { T } = useTheme();
  return <SlidersHorizontal size={20} color={T.ink} strokeWidth={2} />;
}

function SearchIcon() {
  const { T } = useTheme();
  return <Search size={20} color={T.ink} strokeWidth={2} />;
}

export default function ClosetScreen({ navigation }) {
  const { T } = useTheme();
  const cs = useMemo(() => makeStyles(T), [T]);
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

      {/* The pills live in a plain row View, exactly like every other pill row
          in the app. Styling the ScrollView's own contentContainerStyle instead
          let the container drive their layout, which pushed them around on
          selection; the ScrollView now only scrolls. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={cs.chipScroller}>
        <View style={cs.chipRow}>
          <Chip label="All" active={cat === 'all'} onPress={() => setCat('all')} />
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={c[0].toUpperCase() + c.slice(1)}
              active={cat === c}
              onPress={() => setCat(c)}
            />
          ))}
        </View>
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

const makeStyles = (T) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.paper },
  brandBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 12,
  },
  brandLogo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordmark: { fontFamily: FONTS.displayBlack, fontSize: 22, lineHeight: 29, color: T.indigo },
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
  // A horizontal ScrollView in a column parent grows to fill the leftover
  // height unless pinned, which drags the row off its intended position.
  chipScroller: { flexGrow: 0, flexShrink: 0 },
  // Same shape as the shared <Row>, which is what every other pill row uses.
  chipRow: {
    flexDirection: 'row', gap: 8,
    paddingLeft: 24, paddingRight: 12, paddingVertical: 12,
  },
  divider: { height: 1, backgroundColor: T.seam },
  empty: { padding: 40, alignItems: 'center' },
});
