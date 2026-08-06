import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Stitch, Micro, Hint, Banner } from '../components/ui';
import PackingSheet from '../components/PackingSheet';
import { findGaps } from '../api';
import { listItems, listWearLog, washAll, getSetting } from '../db';
import { cancelLaundryReminder } from '../services/notifications';
import { T } from '../theme';

export default function LogScreen() {
  const [items, setItems] = useState([]);
  const [log, setLog] = useState([]);
  const [profile, setProfile] = useState({ styles: [], contexts: [] });
  const [gaps, setGaps] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [packing, setPacking] = useState(false);

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
          <Text style={l.title}>Log</Text>
          <Text style={l.count}>{log.length} days recorded</Text>
        </View>

        {dirty.length > 0 && (
          <Banner tone="warn" action="Mark washed" onAction={wash}>
            <View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: T.ink }}>
                {dirty.length} pieces in the worn pile
              </Text>
              <Text style={{ fontSize: 12, color: T.muted, marginTop: 2 }} numberOfLines={2}>
                {dirty.slice(0, 3).map((i) => i.name).join(', ')}{dirty.length > 3 ? '…' : ''}
              </Text>
            </View>
          </Banner>
        )}

        <Stitch label="WHAT YOU WORE" />
        {log.length === 0 ? (
          <Hint>Nothing logged yet. Build an outfit and tap “Wearing this today”.</Hint>
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

        <Stitch label="WEAR & WORTH" />
        <View style={l.totals}>
          <View>
            <Micro>Closet value</Micro>
            <Text style={l.big}>{Math.round(totalSpend)}</Text>
          </View>
          <View>
            <Micro>Total wears</Micro>
            <Text style={l.big}>{totalWears}</Text>
          </View>
          <View>
            <Micro>Average per wear</Micro>
            <Text style={l.big}>{totalWears ? (totalSpend / totalWears).toFixed(2) : '—'}</Text>
          </View>
        </View>

        {!!most.length && (
          <>
            <Micro style={{ marginTop: 18 }}>Earning their keep</Micro>
            {most.map((i) => (
              <View key={i.id} style={l.statRow}>
                <Text style={l.statName} numberOfLines={1}>{i.name}</Text>
                <Text style={l.statVal}>
                  {i.price ? `${(i.price / Math.max(i.wears, 1)).toFixed(2)}/wear` : `${i.wears} wears`}
                </Text>
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

        <Stitch label="WHAT'S MISSING" />
        <Button title={busy ? 'Reading your closet…' : 'Find the gaps'} variant="ghost" busy={busy} onPress={runGaps} />
        {!!error && <View style={{ marginTop: 12 }}><Banner tone="error">{error}</Banner></View>}
        {gaps?.map((gp, n) => (
          <View key={n} style={l.gapRow}>
            <Text style={l.gapTitle}>{gp.gap}</Text>
            <Text style={l.logSub}>{gp.why}</Text>
          </View>
        ))}

        <Stitch label="GOING SOMEWHERE" />
        <Button title="Build a packing list" variant="ghost" onPress={() => setPacking(true)} />
      </ScrollView>

      <PackingSheet visible={packing} onClose={() => setPacking(false)} items={items} />
    </SafeAreaView>
  );
}

const l = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.paper },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.9, color: T.ink },
  count: { fontSize: 11, color: T.muted },
  logRow: {
    flexDirection: 'row', gap: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderColor: T.seam, borderStyle: 'dashed',
  },
  logDate: { fontSize: 11, color: T.muted, width: 44, paddingTop: 2 },
  logName: { fontSize: 14, fontWeight: '500', color: T.ink },
  logSub: { fontSize: 12, color: T.muted, marginTop: 2, lineHeight: 17 },
  totals: { flexDirection: 'row', justifyContent: 'space-between' },
  big: { fontSize: 20, fontWeight: '700', color: T.ink },
  statRow: {
    flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 7,
    borderBottomWidth: 1, borderColor: T.seam, borderStyle: 'dashed',
  },
  statName: { fontSize: 13, color: T.ink, flex: 1 },
  statVal: { fontSize: 11, color: T.muted },
  gapRow: { paddingVertical: 10, borderBottomWidth: 1, borderColor: T.seam, borderStyle: 'dashed' },
  gapTitle: { fontSize: 14, fontWeight: '600', color: T.ink },
});
