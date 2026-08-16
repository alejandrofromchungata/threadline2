import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, Alert, Pressable } from 'react-native';
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
import { FONTS, getStatus, formalityDots } from '../theme';
import { useTheme } from '../ThemeContext';

const QUICK = ['Work', 'Date Night', 'Casual', 'Wedding', 'Gym', 'Brunch'];

const SearchIcon = () => {
  const { T } = useTheme();
  return (
    <Svg viewBox="0 0 24 24" width={18} height={18}>
      <Path d="M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z" stroke={T.muted} strokeWidth={2} fill="none" />
      <Path d="M21 21l-4.3-4.3" stroke={T.muted} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
};
const CloudRainIcon = () => {
  const { T } = useTheme();
  return (
    <Svg viewBox="0 0 24 24" width={20} height={19}>
      <Path
        d="M6 14a4 4 0 0 1 .3-8 5.5 5.5 0 0 1 10.6 1.7A3.5 3.5 0 0 1 16.5 14H6Z"
        stroke={T.indigo} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
      <Path d="M8 18v1M12 18v2M16 18v1" stroke={T.indigo} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
};

const XIcon = () => {
  const { T } = useTheme();
  return <Svg viewBox="0 0 24 24" width={18} height={18}><Path d="M6 6l12 12M18 6L6 18" stroke={T.ink} strokeWidth={2} strokeLinecap="round" /></Svg>;
};
const ShuffleIcon = () => {
  const { T } = useTheme();
  return (
    <Svg viewBox="0 0 24 24" width={18} height={18}>
      <Path d="M4 6h3l9 12h4M4 18h3l3-4M16 6h4M17 4l3 2-3 2M17 20l3-2-3-2" stroke={T.indigo} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
};
const HeartIcon = () => {
  const { T } = useTheme();
  return <Svg viewBox="0 0 24 24" width={18} height={18}><Path d="M12 21s-7-4.4-9.5-8.8C.7 8.6 2.6 5 6.2 5c2 0 3.3 1 4.8 3 1.5-2 2.8-3 4.8-3 3.6 0 5.5 3.6 3.7 7.2C19 16.6 12 21 12 21Z" stroke={T.rust} strokeWidth={1.8} fill="none" strokeLinejoin="round" /></Svg>;
};
const BookmarkIcon = () => {
  const { T } = useTheme();
  return <Svg viewBox="0 0 24 24" width={18} height={18}><Path d="M6 4h12v16l-6-4-6 4V4Z" stroke={T.indigo} strokeWidth={1.8} fill="none" strokeLinejoin="round" /></Svg>;
};
const BackArrow = () => {
  const { T } = useTheme();
  return <Svg viewBox="0 0 24 24" width={16} height={16}><Path d="M15 5l-7 7 7 7" stroke={T.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" /></Svg>;
};

export default function OutfitScreen() {
  const { T } = useTheme();
  const g = useMemo(() => makeStyles(T), [T]);
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
      itemIds: outfit.itemIds,
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
          <Pressable style={g.backLink} onPress={() => setOutfit(null)} hitSlop={8} accessibilityRole="button">
            <BackArrow />
            <Text style={g.backText}>Back</Text>
          </Pressable>
          <Heading size={18}>Your Cut Sheet</Heading>
          <Eyebrow strong>OUTFIT</Eyebrow>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <CareCard eyebrow={occasion || 'AN ORDINARY DAY'} accent>
            <Heading size={26}>{outfit.name}</Heading>
          </CareCard>

          <View style={g.grid}>
            {chosen.map((i) => {
              const status = getStatus(T)[i.status] || getStatus(T).clean;
              const itemCpw = i.price ? (i.price / Math.max(i.wears, 1)).toFixed(0) : null;
              return (
                <View key={i.id} style={g.piece}>
                  <View style={g.pieceArt}>
                    {i.imageUri ? (
                      <Image source={{ uri: i.imageUri }} style={{ width: '100%', height: 130 }} contentFit="contain" />
                    ) : (
                      <Garment category={i.category} color={i.color} size={72} />
                    )}
                    <View style={g.pieceStatusBadge}>
                      <View style={[g.pieceStatusDot, { backgroundColor: status.dot }]} />
                      <Text style={g.pieceStatusText}>{status.label.toLowerCase()}</Text>
                    </View>
                  </View>
                  <View style={g.pieceLabel}>
                    <Text style={g.pieceCat}>{i.category}</Text>
                    <Text style={g.pieceName} numberOfLines={2}>{i.name}</Text>
                  </View>
                  <View style={g.pieceCareStrip}>
                    <Text style={g.pieceCareText} numberOfLines={1}>{i.material || '—'}</Text>
                    <Text style={g.pieceCareDots}>{formalityDots(i.formality)} CPW</Text>
                    <Text style={g.pieceCarePrice}>{itemCpw ? `${itemCpw}` : '—'}</Text>
                  </View>
                </View>
              );
            })}
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
          <Button title="Wearing This Today • Log It" busy={busy} onPress={wearIt} />
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
        <Eyebrow strong>{clean.length} CLEAN</Eyebrow>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Eyebrow tone="indigo" strong style={{ fontSize: 12, lineHeight: 16 }}>01 / DEFINE DESTINATION</Eyebrow>
        <Heading size={32} style={{ marginTop: 4, marginBottom: 16, lineHeight: 43 }}>Where are you headed?</Heading>

        <View style={g.inputBox}>
          <SearchIcon />
          <TextInput
            value={occasion}
            onChangeText={setOccasion}
            placeholder="E.g., Gallery opening in Chelsea"
            placeholderTextColor={T.muted}
            style={g.inputText}
          />
        </View>
        <Row style={{ marginTop: 12 }}>
          {QUICK.map((q) => (
            <Chip key={q} label={q} active={occasion === q} onPress={() => setOccasion(q)} />
          ))}
        </Row>

        {(weather || weatherNote) && (
          <CareCard eyebrow="02 / LOCAL CONDITIONS" style={{ marginTop: 20 }}>
            {weather ? (
              <>
                <Heading size={22}>{weather.sky}, {weather.temp}{weather.unit}</Heading>
                <View style={g.hr} />
                <View style={g.wxRow}>
                  <View style={g.wxCondition}>
                    <CloudRainIcon />
                    <Text style={g.wxConditionText}>{describeWeather(weather)}</Text>
                  </View>
                  <Text style={g.wxLine}>
                    {weather.rainChance >= 15 ? `${weather.rainChance}% RAIN CHANCE` : `HIGH ${weather.high} / LOW ${weather.low}`}
                  </Text>
                </View>
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
            <Pressable onPress={() => setOccasion(occasionFromEvent(events[0]).occasion)}>
              <Text style={g.eventTitle}>{events[0].title}</Text>
              <View style={g.timeLocationRow}>
                <Text style={g.eventMeta}>
                  {events[0].start.toDateString() === new Date().toDateString() ? 'TODAY' : events[0].start.toDateString().toUpperCase()}
                  {' • '}{events[0].start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </Text>
                {!!events[0].location && <Text style={g.eventMetaAccent}>{events[0].location.toUpperCase()}</Text>}
              </View>
            </Pressable>
            {events.length > 1 && (
              <Row style={{ marginTop: 10 }}>
                {events.slice(0, 4).map((e) => (
                  <Chip
                    key={e.id}
                    small
                    label={e.title.length > 28 ? `${e.title.slice(0, 26)}…` : e.title}
                    active={occasion === occasionFromEvent(e).occasion}
                    onPress={() => setOccasion(occasionFromEvent(e).occasion)}
                  />
                ))}
              </Row>
            )}
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
        <Button title="Style Me • Begin Stitching" busy={busy} onPress={() => generate(false)} />
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (T) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.paper },
  navBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 12,
  },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { fontFamily: FONTS.sans, fontSize: 14, color: T.ink },
  field: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.seam, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 14, fontFamily: FONTS.sans, fontSize: 15, color: T.ink,
  },
  inputBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.seam, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  inputText: { flex: 1, fontFamily: FONTS.sans, fontSize: 15, color: T.ink, padding: 0 },
  hr: { height: 1, backgroundColor: T.seam },
  eventMeta: { fontFamily: FONTS.mono, fontSize: 11, lineHeight: 14, color: T.muted },
  eventMetaAccent: { fontFamily: FONTS.mono, fontSize: 11, lineHeight: 14, color: T.indigo },
  wxLine: { fontFamily: FONTS.monoSemi, fontSize: 13, lineHeight: 17, color: T.indigo, letterSpacing: 0 },
  wxRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wxCondition: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wxConditionText: { fontFamily: FONTS.sansSemi, fontSize: 15, color: T.ink },
  eventTitle: { fontFamily: FONTS.display, fontSize: 20, lineHeight: 27, color: T.ink },
  timeLocationRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  faint: { fontFamily: FONTS.mono, fontSize: 10, lineHeight: 13, color: T.muted, letterSpacing: 0 },
  footer: { padding: 20, paddingTop: 12, gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 20 },
  piece: {
    width: '47%', borderWidth: 1, borderColor: T.seam, borderRadius: 8,
    backgroundColor: T.card, overflow: 'hidden',
  },
  pieceArt: {
    height: 130, alignItems: 'center', justifyContent: 'center', backgroundColor: T.photoBg,
    position: 'relative',
  },
  pieceStatusBadge: {
    position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: T.card, borderRadius: 100, paddingHorizontal: 4, paddingVertical: 4,
    borderWidth: 1, borderColor: T.seam,
  },
  pieceStatusDot: { width: 8, height: 8, borderRadius: 4 },
  pieceStatusText: { fontFamily: FONTS.monoSemi, fontSize: 9, color: T.ink },
  pieceLabel: { padding: 10, borderTopWidth: 1, borderColor: T.seam },
  pieceCat: { fontFamily: FONTS.mono, fontSize: 9, lineHeight: 12, letterSpacing: 0, textTransform: 'uppercase', color: T.muted },
  pieceName: { fontFamily: FONTS.display, fontSize: 16, color: T.ink, marginTop: 2 },
  pieceCareStrip: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderColor: T.seam, backgroundColor: T.careStrip,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  pieceCareText: { fontFamily: FONTS.mono, fontSize: 9, color: T.muted, flexShrink: 1 },
  pieceCareDots: { fontFamily: FONTS.monoSemi, fontSize: 9, color: T.indigo },
  pieceCarePrice: { fontFamily: FONTS.mono, fontSize: 9, color: T.ink },
  why: { fontFamily: FONTS.displayRegular, fontSize: 16, lineHeight: 24, color: T.ink, fontStyle: 'italic' },
  gap: { fontFamily: FONTS.sansMedium, fontSize: 14, color: T.ink, lineHeight: 20 },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 },
});
