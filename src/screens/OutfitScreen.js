import React, { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import Garment from '../components/Garment';
import { Button, Chip, Row, Stitch, Micro, Hint, Banner } from '../components/ui';
import { buildOutfit } from '../api';
import { getWeather, describeWeather } from '../services/weather';
import { getUpcomingEvents, occasionFromEvent } from '../services/calendar';
import { scheduleLaundryReminder } from '../services/notifications';
import {
  listItems, getSetting, markWorn, addWearLog, addFeedback, recentFeedback, listWearLog, saveOutfit,
} from '../db';
import { T } from '../theme';

const QUICK = ['work', 'date night', 'casual weekend', 'gym', 'dinner with family', 'travel day'];

export default function OutfitScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [profile, setProfile] = useState({ styles: [], contexts: [] });
  const [weather, setWeather] = useState(null);
  const [weatherNote, setWeatherNote] = useState(null);
  const [events, setEvents] = useState([]);
  const [occasion, setOccasion] = useState('');
  const [busy, setBusy] = useState(false);
  const [outfit, setOutfit] = useState(null);
  const [error, setError] = useState(null);
  const lastCombo = useRef([]);

  const load = useCallback(async () => {
    const [rows, prof] = await Promise.all([listItems(), getSetting('profile', { styles: [], contexts: [] })]);
    setItems(rows);
    setProfile(prof);

    getWeather()
      .then((w) => {
        if (w) setWeather(w);
        else setWeatherNote('Location is off, so the forecast is not being used.');
      })
      .catch(() => setWeatherNote('Could not reach the forecast service.'));

    getUpcomingEvents().then(setEvents).catch(() => setEvents([]));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const clean = items.filter((i) => i.status === 'clean');

  const generate = async (shuffle = false) => {
    if (clean.length < 3) {
      Alert.alert(
        'Not enough clean clothes',
        'Add a few more pieces, or mark some as washed in the Log tab.'
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const [fb, recentLog] = await Promise.all([recentFeedback(6), listWearLog(3)]);
      const res = await buildOutfit({
        occasion: occasion.trim() || 'an ordinary day',
        profile,
        weather: weather
          ? { ...weather, description: describeWeather(weather) }
          : null,
        closet: clean.map((i) => ({
          id: i.id, name: i.name, category: i.category, colour: i.colorName,
          material: i.material, formality: i.formality, seasons: i.seasons, tags: i.tags,
        })),
        feedback: fb.map((f) => ({ occasion: f.occasion, verdict: f.verdict, items: f.itemNames })),
        recentlyWorn: recentLog.flatMap((l) => l.itemIds),
        avoid: shuffle ? lastCombo.current : [],
      });
      const valid = (res.itemIds || []).filter((id) => clean.some((i) => i.id === id));
      if (!valid.length) throw new Error('The stylist could not find a workable combination.');
      setOutfit({ ...res, itemIds: valid });
      lastCombo.current = valid;
    } catch (e) {
      setError(e.message || 'Could not build an outfit right now.');
    } finally {
      setBusy(false);
    }
  };

  const react = async (verdict) => {
    await addFeedback({
      occasion: occasion.trim() || 'ordinary day',
      verdict,
      itemNames: outfit.itemIds.map((id) => items.find((i) => i.id === id)?.name).filter(Boolean),
    });
    if (verdict === 'down') generate(true);
  };

  const wearIt = async () => {
    const date = new Date().toISOString().slice(0, 10);
    await markWorn(outfit.itemIds, date);
    await addWearLog({
      date,
      occasion: occasion.trim() || 'ordinary day',
      name: outfit.name,
      itemIds: outfit.itemIds,
      weather: weather ? describeWeather(weather) : '',
    });
    const fresh = await listItems();
    setItems(fresh);
    const dirty = fresh.filter((i) => i.status === 'dirty');
    if (dirty.length >= 8) {
      const cats = [...new Set(dirty.map((i) => i.category))].slice(0, 2);
      scheduleLaundryReminder(dirty.length, cats).catch(() => {});
    }
    setOutfit(null);
    navigation.navigate('Log');
  };

  const chosen = outfit
    ? outfit.itemIds.map((id) => items.find((i) => i.id === id)).filter(Boolean)
    : [];

  return (
    <SafeAreaView style={g.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <View style={g.head}>
          <Text style={g.title}>Get dressed</Text>
          <Text style={g.count}>{clean.length} clean</Text>
        </View>

        {weather ? (
          <View style={g.wx}>
            <View>
              <Micro style={{ marginBottom: 2 }}>Right now</Micro>
              <Text style={g.wxTemp}>{weather.temp}{weather.unit}</Text>
            </View>
            <Text style={g.wxDesc}>
              {weather.sky}, high {weather.high} / low {weather.low}
              {weather.rainChance >= 30 ? `, ${weather.rainChance}% rain` : ''}
            </Text>
          </View>
        ) : (
          !!weatherNote && <Banner tone="warn">{weatherNote}</Banner>
        )}

        {!!events.length && (
          <>
            <Micro style={{ marginTop: 16 }}>From your calendar</Micro>
            <Row>
              {events.slice(0, 4).map((e) => (
                <Chip
                  key={e.id}
                  small
                  label={e.title.length > 24 ? `${e.title.slice(0, 22)}…` : e.title}
                  active={occasion === occasionFromEvent(e).occasion}
                  onPress={() => setOccasion(occasionFromEvent(e).occasion)}
                />
              ))}
            </Row>
          </>
        )}

        <Micro style={{ marginTop: 16 }}>Where are you going?</Micro>
        <TextInput
          value={occasion}
          onChangeText={setOccasion}
          placeholder="dinner with his parents"
          placeholderTextColor="#A9A69C"
          style={g.field}
        />
        <Row style={{ marginTop: 10 }}>
          {QUICK.map((q) => (
            <Chip key={q} small label={q} active={occasion === q} onPress={() => setOccasion(q)} />
          ))}
        </Row>

        <Button
          title={outfit ? 'Build another' : 'Build my outfit'}
          busy={busy}
          style={{ marginTop: 20 }}
          onPress={() => generate(false)}
        />

        {!!error && <View style={{ marginTop: 14 }}><Banner tone="error">{error}</Banner></View>}

        {outfit && (
          <View style={g.sheet}>
            <Stitch label="CUT SHEET" style={{ marginTop: 0 }} />
            <Text style={g.outfitName}>{outfit.name}</Text>

            <View style={g.pieces}>
              {chosen.map((i) => (
                <View key={i.id} style={g.piece}>
                  {i.imageUri ? (
                    <Image source={{ uri: i.imageUri }} style={{ width: 78, height: 78 }} contentFit="contain" />
                  ) : (
                    <Garment category={i.category} color={i.color} size={78} />
                  )}
                  <Text style={g.pieceCat}>{i.category}</Text>
                  <Text style={g.pieceName} numberOfLines={2}>{i.name}</Text>
                </View>
              ))}
            </View>

            <Text style={g.why}>{outfit.why}</Text>
            {!!outfit.missing && <Text style={g.gap}>Gap: {outfit.missing}</Text>}

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <Button title="Like this" variant="ghost" style={{ flex: 1 }} onPress={() => react('up')} />
              <Button title="Not it" variant="ghost" style={{ flex: 1 }} onPress={() => react('down')} />
              <Button title="Shuffle" variant="ghost" style={{ flex: 1 }} busy={busy} onPress={() => generate(true)} />
            </View>
            <Button
              title="Save to favourites"
              variant="ghost"
              style={{ marginTop: 8 }}
              onPress={() => saveOutfit({ name: outfit.name, occasion, itemIds: outfit.itemIds })}
            />
            <Button title="Wearing this today" style={{ marginTop: 8 }} onPress={wearIt} />
          </View>
        )}

        {!outfit && !busy && (
          <Hint style={{ marginTop: 20 }}>
            Threadline only picks from pieces marked clean, weighs the forecast and your past reactions,
            and tells you what it is missing.
          </Hint>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const g = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.paper },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.9, color: T.ink },
  count: { fontSize: 11, color: T.muted },
  wx: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: T.seam, borderStyle: 'dashed', borderRadius: 2, padding: 12,
  },
  wxTemp: { fontSize: 22, fontWeight: '700', color: T.ink },
  wxDesc: { fontSize: 12, color: T.muted, flex: 1, textAlign: 'right', marginLeft: 12 },
  field: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.seam, borderRadius: 2,
    paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: T.ink,
  },
  sheet: {
    marginTop: 26, borderWidth: 1, borderColor: T.seamDark, borderStyle: 'dashed',
    borderRadius: 3, padding: 16, backgroundColor: T.card,
  },
  outfitName: { fontSize: 22, fontWeight: '700', letterSpacing: -0.6, color: T.ink, marginBottom: 14 },
  pieces: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  piece: {
    flexGrow: 1, flexBasis: '30%', minWidth: 96, alignItems: 'center',
    borderWidth: 1, borderColor: T.seam, borderStyle: 'dashed', borderRadius: 2, padding: 8,
  },
  pieceCat: { fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase', color: T.muted, marginTop: 4 },
  pieceName: { fontSize: 12, textAlign: 'center', color: T.ink, marginTop: 2 },
  why: { fontSize: 14, lineHeight: 21, color: T.ink, marginTop: 16, borderLeftWidth: 2, borderColor: T.indigo, paddingLeft: 12 },
  gap: { fontSize: 12, color: T.ochre, marginTop: 10 },
});
