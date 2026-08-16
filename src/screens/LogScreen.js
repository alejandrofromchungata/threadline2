import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Button, Stitch, Micro, Hint, Banner } from '../components/ui';
import { findGaps } from '../api';
import { listItems, listWearLog, washAll, getSetting } from '../db';
import { cancelLaundryReminder } from '../services/notifications';
import { FONTS } from '../theme';
import { useTheme } from '../ThemeContext';

export default function LogScreen({ navigation }) {
  const { T } = useTheme();
  const l = useMemo(() => makeStyles(T), [T]);
  const [items, setItems] = useState([]);
  const [log, setLog] = useState([]);
  const [profile, setProfile] = useState({ styles: [], contexts: [] });
  const [gaps, setGaps] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const [rows, entries, prof] = await Promise.all([
      listItems(), listWearLog(40), getSetting('profile', { styles: [], contexts: [] }),
    ]);
    setItems(rows);
    setLog(entries);
    setProfile(prof);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const dirty = items.filter((i) => i.status === 'dirty' || i.status === 'laundry');
  const ranked = [...items].sort((a, b) => b.wears - a.wears);
  const most = ranked.filter((i) => i.wears > 0).slice(0, 3);
  const never = ranked.filter((i) => i.wears === 0).slice(0, 4);
  const totalSpend = items.reduce((n, i) => n + (i.price || 0), 0);
  const totalWears = items.reduce((n, i) => n + i.wears, 0);

  const wash = async () => {
    await washAll();
    await cancelLaundryReminder();
    load();
  };

  const runGaps = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await findGaps({
        profile,
        closet: items.map((i) => ({
          name: i.name, category: i.category, colour: i.colorName,
          formality: i.formality, seasons: i.seasons,
        })),
      });
      setGaps(res.gaps || []);
    } catch (e) {
      setError(e.message || 'Could not run the audit.');
    } finally {
      setBusy(false);
    }
  };

  const nameOf = (id) => items.find((i) => i.id === id)?.name;

  return (
    <SafeAreaView style={l.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <View style={l.head}>
          <Text style={l.title}>Wardrobe Log & Metrics</Text>
          <Micro>{log.length} days recorded</Micro>
        </View>

        {dirty.length > 0 && (
          <View style={l.laundryCard}>
            <Micro>Washing deck · Laundry time</Micro>
            <Text style={l.laundryTitle}>{`Laundry pile: ${dirty.length} ${dirty.length === 1 ? 'piece' : 'pieces'}`}</Text>
            <View style={l.hr} />
            <View style={l.laundryRow}>
              <Text style={l.laundryHint} numberOfLines={2}>
                {dirty.slice(0, 3).map((i) => i.name).join(', ')}{dirty.length > 3 ? '…' : ''}
              </Text>
              <Button title="Mark All Clean" onPress={wash} style={{ paddingVertical: 8, paddingHorizontal: 12, minHeight: 0 }} />
            </View>
          </View>
        )}

        <View style={l.statsRow}>
          <View style={l.statCard}>
            <Micro>Closet value</Micro>
            <Text style={l.statValue}>{Math.round(totalSpend)}</Text>
          </View>
          <View style={l.statCard}>
            <Micro>Total wears</Micro>
            <Text style={l.statValue}>{totalWears}</Text>
          </View>
          <View style={l.statCard}>
            <Micro>Avg CPW</Micro>
            <Text style={l.statValue}>{totalWears ? (totalSpend / totalWears).toFixed(2) : '—'}</Text>
          </View>
        </View>

        {!!most.length && (
          <>
            <Micro style={{ marginTop: 4, marginBottom: 10 }}>Most worn pieces</Micro>
            {most.map((i) => (
              <View key={i.id} style={l.wornRow}>
                {i.imageUri ? (
                  <Image source={{ uri: i.imageUri }} style={l.wornImg} contentFit="cover" />
                ) : (
                  <View style={[l.wornImg, { backgroundColor: T.cardArt }]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={l.wornName} numberOfLines={1}>{i.name}</Text>
                  <View style={l.wornMetrics}>
                    <Text style={l.wornWears}>{`${i.wears} wears`}</Text>
                    <Text style={l.statVal}>
                      {i.price ? `${(i.price / Math.max(i.wears, 1)).toFixed(2)}/wear` : '—'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        {!!never.length && (
          <>
            <Micro style={{ marginTop: 18 }}>Never worn</Micro>
            {never.map((i) => (
              <View key={i.id} style={l.statRow}>
                <Text style={l.statName} numberOfLines={1}>{i.name}</Text>
                <Text style={l.statVal}>{i.price ? `${i.price}` : 'no price set'}</Text>
              </View>
            ))}
            <Hint style={{ marginTop: 8 }}>Wear one of these before buying anything new.</Hint>
          </>
        )}

        <Stitch label="WHAT YOU WORE" />
        {log.length === 0 ? (
          <Hint>Nothing logged yet. Build an outfit and tap "Wearing this today".</Hint>
        ) : (
          log.map((entry) => (
            <View key={entry.id} style={l.logRow}>
              <Text style={l.logDate}>{entry.date.slice(5)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={l.logName}>{entry.name}</Text>
                <Text style={l.logSub} numberOfLines={2}>
                  {entry.occasion} · {entry.itemIds.map(nameOf).filter(Boolean).join(' + ')}
                </Text>
              </View>
            </View>
          ))
        )}

        <Stitch label="WHAT'S MISSING" />
        {gaps?.length ? (
          <View style={l.gapCard}>
            <Micro style={{ color: T.indigo }}>Wardrobe gap report</Micro>
            <Text style={l.gapCardTitle}>Identified stitch gaps:</Text>
            <Text style={l.gapCardText}>{gaps.map((g) => g.gap).join('; ')}.</Text>
          </View>
        ) : (
          <Button title={busy ? 'Reading your closet…' : 'Find the gaps'} variant="ghost" busy={busy} onPress={runGaps} />
        )}
        {!!error && <View style={{ marginTop: 12 }}><Banner tone="error">{error}</Banner></View>}

        <Stitch label="GOING SOMEWHERE" />
        <Button title="Build a packing list" variant="ghost" onPress={() => navigation.navigate('Packing')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (T) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.paper },
  head: { marginBottom: 16, gap: 4 },
  title: { fontFamily: FONTS.display, fontSize: 22, color: T.ink },
  count: { fontSize: 11, color: T.muted },
  laundryCard: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.seam, borderRadius: 8,
    padding: 16, gap: 8, marginBottom: 16,
  },
  laundryTitle: { fontFamily: FONTS.display, fontSize: 22, color: T.ink },
  hr: { height: 1, backgroundColor: T.seam },
  laundryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  laundryHint: { flex: 1, fontFamily: FONTS.sans, fontSize: 13, color: T.muted },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: T.card, borderWidth: 1, borderColor: T.seam, borderRadius: 8,
    padding: 12, gap: 4,
  },
  statValue: { fontFamily: FONTS.display, fontSize: 22, color: T.indigo },
  wornRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, marginBottom: 8,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.seam, borderRadius: 8,
  },
  wornImg: { width: 40, height: 40, borderRadius: 4 },
  wornName: { fontFamily: FONTS.display, fontSize: 15, color: T.ink },
  wornMetrics: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  wornWears: { fontFamily: FONTS.monoSemi, fontSize: 11, color: T.indigo },
  logRow: {
    flexDirection: 'row', gap: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderColor: T.seam, borderStyle: 'dashed',
  },
  logDate: { fontSize: 11, color: T.muted, width: 44, paddingTop: 2 },
  logName: { fontSize: 14, fontWeight: '500', color: T.ink },
  logSub: { fontSize: 12, color: T.muted, marginTop: 2, lineHeight: 17 },
  statRow: {
    flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 7,
    borderBottomWidth: 1, borderColor: T.seam, borderStyle: 'dashed',
  },
  statName: { fontSize: 13, color: T.ink, flex: 1 },
  statVal: { fontSize: 11, color: T.muted },
  gapCard: {
    backgroundColor: T.paper, borderWidth: 2, borderColor: T.indigo, borderRadius: 8,
    padding: 16, gap: 8,
  },
  gapCardTitle: { fontFamily: FONTS.display, fontSize: 18, color: T.ink },
  gapCardText: { fontFamily: FONTS.sans, fontSize: 13, color: T.muted, lineHeight: 18 },
});
