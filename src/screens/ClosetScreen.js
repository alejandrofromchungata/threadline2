import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TextInput, Pressable, StyleSheet, ScrollView, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import ItemCard from '../components/ItemCard';
import { Chip, Button, Hint, Micro } from '../components/ui';
import { listItems } from '../db';
import { T, CATEGORIES } from '../theme';

const SORTS = [
  ['recent', 'added'],
  ['worn', 'most worn'],
  ['cpw', 'cost per wear'],
  ['name', 'a–z'],
];

export default function ClosetScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [sort, setSort] = useState('recent');
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

  const cardWidth = (Math.min(width, 620) - 40 - 12) / 2;

  return (
    <SafeAreaView style={cs.safe} edges={['top']}>
      <View style={cs.head}>
        <Text style={cs.title}>Closet</Text>
        <Text style={cs.count}>{items.length} pieces</Text>
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search — try “wool” or “date night”"
          placeholderTextColor="#A9A69C"
          style={cs.search}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={cs.chipRow}
      >
        <Chip small label="all" active={cat === 'all'} onPress={() => setCat('all')} />
        {CATEGORIES.map((c) => (
          <Chip key={c} small label={c} active={cat === c} onPress={() => setCat(c)} />
        ))}
      </ScrollView>

      <View style={cs.sortRow}>
        <Micro style={{ marginBottom: 0 }}>Sort</Micro>
        {SORTS.map(([k, l]) => (
          <Pressable key={k} onPress={() => setSort(k)} hitSlop={8}>
            <Text style={[cs.sortLink, sort === k && cs.sortOn]}>{l}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={shown}
        keyExtractor={(i) => i.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 20 }}
        contentContainerStyle={{ gap: 12, paddingBottom: 120 }}
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
              <Text style={cs.emptyTitle}>
                {items.length ? 'Nothing matches that.' : 'The closet is empty.'}
              </Text>
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

      <Pressable
        style={cs.fab}
        onPress={() => navigation.navigate('AddItem')}
        accessibilityRole="button"
        accessibilityLabel="Add a piece"
      >
        <Text style={cs.fabText}>+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const cs = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.paper },
  head: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.9, color: T.ink },
  count: { fontSize: 11, color: T.muted },
  search: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.seam, borderRadius: 2,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: T.ink,
  },
  chipRow: { gap: 7, paddingHorizontal: 20, paddingVertical: 12 },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingBottom: 14 },
  sortLink: { fontSize: 12, color: T.muted },
  sortOn: { color: T.indigo, textDecorationLine: 'underline' },
  empty: { padding: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: T.ink },
  fab: {
    position: 'absolute', right: 20, bottom: 28, width: 56, height: 56, borderRadius: 28,
    backgroundColor: T.indigo, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#2B3A7E', shadowOpacity: 0.34, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 30, lineHeight: 34, fontWeight: '400' },
});
