import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { Search } from 'lucide-react-native';
import { Chip, Row, Micro } from './ui';
import { useTheme } from '../ThemeContext';

/**
 * Long option lists get unwieldy on a phone, so this filters as you type
 * and lets you add anything the list is missing.
 */
export default function ChipPicker({
  options,
  custom = [],
  selected = [],
  onToggle,
  onAddCustom,
  placeholder = 'Search or add your own',
}) {
  const { T } = useTheme();
  const p = useMemo(() => makeStyles(T), [T]);
  const [q, setQ] = useState('');

  const all = useMemo(() => [...options, ...custom], [options, custom]);
  const needle = q.trim().toLowerCase();

  const shown = useMemo(() => {
    if (!needle) return all;
    return all.filter((o) => o.toLowerCase().includes(needle));
  }, [all, needle]);

  const exact = all.some((o) => o.toLowerCase() === needle);
  const canAdd = needle.length > 1 && !exact;

  const add = () => {
    const value = q.trim().toLowerCase();
    if (!value) return;
    onAddCustom(value);
    setQ('');
  };

  return (
    <View>
      <View style={p.searchBox}>
        <Search size={18} color={T.muted} strokeWidth={2} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={placeholder}
          placeholderTextColor={T.muted}
          style={p.search}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={canAdd ? add : undefined}
        />
      </View>

      {canAdd && (
        <Pressable onPress={add} style={p.addRow}>
          <Text style={p.addText}>Add “{q.trim()}”</Text>
        </Pressable>
      )}

      {!shown.length && !canAdd && (
        <Micro style={{ marginTop: 10 }}>Nothing matches that.</Micro>
      )}

      <Row style={{ marginTop: 12 }}>
        {shown.map((o) => (
          <Chip key={o} label={o} picker active={selected.includes(o)} onPress={() => onToggle(o)} />
        ))}
      </Row>

      {selected.length > 0 && (
        <Text style={p.count}>
          {selected.length} selected
        </Text>
      )}
    </View>
  );
}

const makeStyles = (T) => StyleSheet.create({
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.seam, borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  search: {
    flex: 1, padding: 0,
    fontFamily: FONTS.sans, fontSize: 14, lineHeight: 18, color: T.ink,
  },
  addRow: {
    marginTop: 8, paddingVertical: 9, paddingHorizontal: 12,
    borderWidth: 1, borderColor: T.indigo, borderStyle: 'dashed', borderRadius: 2,
  },
  addText: { fontSize: 13, color: T.indigo, fontWeight: '500' },
  count: { fontSize: 11, color: T.muted, marginTop: 10 },
});
