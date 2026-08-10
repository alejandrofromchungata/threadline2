import React, { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import Garment from '../components/Garment';
import { Button, IconButton, Chip, Row, Eyebrow, Heading, Hint, Banner, CareCard } from '../components/ui';
import { buildOutfit } from '../api';
import { getWeather, describeWeather } from '../services/weather';
import { getUpcomingEvents, occasionFromEvent } from '../services/calendar';
import { scheduleLaundryReminder } from '../services/notifications';
import {
  listItems, getSetting, markWorn, addWearLog, addFeedback, recentFeedback, listWearLog, saveOutfit,
} from '../db';
import { T, FONTS } from '../theme';

const QUICK = ['work', 'date night', 'casual weekend', 'gym', 'dinner with family', 'travel day'];

const XIcon = () => <Svg viewBox="0 0 24 24" width={18} height={18}><Path d="M6 6l12 12M18 6L6 18" stroke={T.ink} strokeWidth={2} strokeLinecap="round" /></Svg>;
const ShuffleIcon = () => (
  <Svg viewBox="0 0 24 24" width={18} height={18}>
    <Path d="M4 6h3l9 12h4M4 18h3l3-4M16 6h4M17 4l3 2-3 2M17 20l3-2-3-2" stroke={T.indigo} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Svg>
);
const HeartIcon = () => <Svg viewBox="0 0 24 24" width={18} height={18}><Path d="M12 21s-7-4.4-9.5-8.8C.7 8.6 2.6 5 6.2 5c2 0 3.3 1 4.8 3 1.5-2 2.8-3 4.8-3 3.6 0 5.5 3.6 3.7 7.2C19 16.6 12 21 12 21Z" stroke={T.rust} strokeWidth={1.8} fill="none" strokeLinejoin="round" /></Svg>;
const BookmarkIcon = () => <Svg viewBox="0 0 24 24" width={18} height={18}><Path d="M6 4h12v16l-6-4-6 4V4Z" stroke={T.indigo} strokeWidth={1.8} fill="none" strokeLinejoin="round" /></Svg>;
const BackArrow = () => <Svg viewBox="0 0 24 24" width={16} height={16}><Path d="M15 5l-7 7 7 7" stroke={T.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" /></Svg>;

export default function OutfitScreen() {
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
      .then((w) => { if (w) setWeather(w); else setWeatherNote('Location is off, so the forecast is not being used.'); })
      .catch(() => setWeatherNote('Could not reach the forecast service.'));

    getUpcomingEvents().then(setEvents).catch(() => setEvents([]));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const clean = items.filter((i) => i.status === 'clean');

  const generate = async (shuffle = false) => {
    if (clean.length < 3) {
      Alert.alert('Not enough clean clothes', 'Add a few more pieces, or mark some as washed in the Log tab.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const [fb, recentLog] = await Promise.all([recentFeedback(6), listWearLog(3)]);
      const res = await buildOutfit({
        occasion: occasion.trim() || 'an ordinary day',
        profile,
        weather: weather ? { ...weather, description: describeWeather(weather) } : null,
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
      date, occasion: occasion.trim() || 'ordinary day', name: outfit.name,
      itemIds: outfit.itemIds, weather: weather ? describeWeather(weather) : '',
    });
    const fresh = await listItems();
    setItems(fresh);
    const dirty = fresh.filter((i) => i.status === 'dirty');
    if (dirty.length >= 8) {
      const cats = [...new Set(dirty.map((i) => i.category))].slice(0, 2);
      scheduleLaundryReminder(dirty.length, cats).catch(() => {});
    }
    setOutfit(null);
  };

  const chosen = outfit ? outfit.itemIds.map((id) => items.find((i) => i.id === id)).filter(Boolean) : [];

  // ── Result phase — matches the "outfit-result" cut-sheet frame ──────
  if (outfit) {
    return (
      <SafeAreaView style={g.safe} edges={['top']}>
        <View style={g.navBar}>
          <View style={g.backLink} onTouchEnd={() => setOutfit(null)}>
            <BackArrow />
            <Text style={g.backText}>Back</Text>
          </View>
          <Heading size={18}>Your Cut Sheet</Heading>
          <Eyebrow>{`OUTFIT`}</Eyebrow>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <CareCard eyebrow={occasion || 'AN ORDINARY DAY'} accent>
            <Heading size={26}>{outfit.name}</Heading>
          </CareCard>

          <View style={g.grid}>
            {chosen.map((i) => (
              <View key={i.id} style={g.piece}>
                {i.imageUri ? (
                  <Image source={{ uri: i.imageUri }} style={{ width: '100%', height: 110 }} contentFit="contain" />
                ) : (
                  <View style={g.pieceArt}><Garment category={i.category} color={i.color} size={72} /></View>
                )}
                <View style={g.pieceLabel}>
                  <Text style={g.pieceCat}>{i.category}</Text>
                  <Text style={g.pieceName} numberOfLines={2}>{i.name}</Text>
                </View>
              </View>
            ))}
          </View>

          <CareCard eyebrow="THE TAILOR'S STYLING NOTE" style={{ marginTop: 20 }}>
            <View style={g.hr} />
            <Text style={g.why}>"{outfit.why}"</Text>
          </CareCard>

          {!!outfit.missing && (
            <CareCard eyebrow="SYSTEM RECOMMENDATION · GAP FOUND" style={{ marginTop: 16, borderWidth: 2 }}>
              <Text style={g.gap}>{outfit.missing}</Text>
            </CareCard>
          )}
        </ScrollView>

        <View style={g.footer}>
          <View style={g.quickRow}>
            <IconButton onPress={() => react('down')}><XIcon /></IconButton>
            <IconButton onPress={() => generate(true)}><ShuffleIcon /></IconButton>
            <IconButton onPress={() => react('up')}><HeartIcon /></IconButton>
            <IconButton onPress={() => saveOutfit({ name: outfit.name, occasion, itemIds: outfit.itemIds })}>
              <BookmarkIcon />
            </IconButton>
          </View>
          <Button title="Wearing This Today · Log It" busy={busy} onPress={wearIt} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Input phase — matches the "outfit-generator" frame ──────────────
  return (
    <SafeAreaView style={g.safe} edges={['top']}>
      <View style={g.navBar}>
        <View />
        <Heading size={18}>Outfit Builder</Heading>
        <Eyebrow>{clean.length} CLEAN</Eyebrow>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Eyebrow tone="indigo">01 / DEFINE DESTINATION</Eyebrow>
        <Heading size={30} style={{ marginTop: 4, marginBottom: 16 }}>Where are you headed?</Heading>

        <TextInput
          value={occasion}
          onChangeText={setOccasion}
          placeholder="E.g., Gallery opening in Chelsea"
          placeholderTextColor={T.muted}
          style={g.field}
        />
        <Row style={{ marginTop: 12 }}>
          {QUICK.map((q) => (
            <Chip key={q} small label={q} active={occasion === q} onPress={() => setOccasion(q)} />
          ))}
        </Row>

        {(weather || weatherNote) && (
          <CareCard eyebrow="02 / LOCAL CONDITIONS" accent style={{ marginTop: 20 }}>
            {weather ? (
              <>
                <Heading size={22}>{weather.sky}, {weather.temp}{weather.unit}</Heading>
                <View style={g.hr} />
                <Text style={g.wxLine}>
                  {weather.rainChance >= 15 ? `${weather.rainChance}% RAIN CHANCE` : `HIGH ${weather.high} / LOW ${weather.low}`}
                </Text>
                <View style={g.hr} />
                <Text style={g.faint}>FORECAST FROM YOUR LOCATION</Text>
              </>
            ) : (
              <Text style={g.faint}>{weatherNote}</Text>
            )}
          </CareCard>
        )}

        {!!events.length && (
          <CareCard eyebrow="03 / DETECTED SCHEDULE" style={{ marginTop: 16 }}>
            <View style={g.hr} />
            {events.slice(0, 4).map((e) => (
              <Chip
                key={e.id}
                label={e.title.length > 28 ? `${e.title.slice(0, 26)}…` : e.title}
                active={occasion === occasionFromEvent(e).occasion}
                onPress={() => setOccasion(occasionFromEvent(e).occasion)}
              />
            ))}
          </CareCard>
        )}

        {!!error && <View style={{ marginTop: 16 }}><Banner tone="error">{error}</Banner></View>}

        {!busy && (
          <Hint style={{ marginTop: 20 }}>
            Threadline only picks from pieces marked clean, weighs the forecast and your past reactions,
            and tells you what it's missing.
          </Hint>
        )}
      </ScrollView>

      <View style={g.footer}>
        <Button title="Style Me · Begin Stitching" busy={busy} onPress={() => generate(false)} />
      </View>
    </SafeAreaView>
  );
}

const g = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.paper },
  navBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 10,
  },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { fontFamily: FONTS.sans, fontSize: 14, color: T.ink },
  field: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.seam, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 14, fontFamily: FONTS.sans, fontSize: 15, color: T.ink,
  },
  hr: { height: 1, backgroundColor: T.seam },
  wxLine: { fontFamily: FONTS.monoSemi, fontSize: 13, color: T.indigo, letterSpacing: 0.4 },
  faint: { fontFamily: FONTS.mono, fontSize: 10, color: T.muted, letterSpacing: 0.4 },
  footer: { padding: 20, paddingTop: 12, gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 20 },
  piece: {
    width: '47%', borderWidth: 1, borderColor: T.seam, borderRadius: 8,
    backgroundColor: T.card, overflow: 'hidden',
  },
  pieceArt: { height: 110, alignItems: 'center', justifyContent: 'center', backgroundColor: T.paper },
  pieceLabel: { padding: 10, borderTopWidth: 1, borderColor: T.seam },
  pieceCat: { fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: T.muted },
  pieceName: { fontFamily: FONTS.display, fontSize: 15, color: T.ink, marginTop: 2 },
  why: { fontFamily: FONTS.displayRegular, fontSize: 16, lineHeight: 24, color: T.ink, fontStyle: 'italic' },
  gap: { fontFamily: FONTS.sansMedium, fontSize: 14, color: T.ink, lineHeight: 20 },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 },
});
