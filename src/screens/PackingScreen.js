import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ArrowLeft, Check } from 'lucide-react-native';
import Garment from '../components/Garment';
import { Field, Button, Hint, Micro, Banner } from '../components/ui';
import { FONTS } from '../theme';
import { packList } from '../api';
import { geocode, getTripForecast } from '../services/weather';
import { listItems } from '../db';
import { useTheme } from '../ThemeContext';

const addDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
// "2026-10-24" -> "OCT 24", parsed as plain calendar parts so a timezone
// offset can't roll the date back a day.
const shortDate = (iso) => {
  const [y, m, d] = (iso || '').split('-').map(Number);
  if (!y || !m || !d) return iso || '';
  return `${MONTHS[m - 1]} ${d}`;
};

function CheckIcon() {
  return <Check size={12} color="#fff" strokeWidth={3} />;
}

export default function PackingScreen({ navigation }) {
  const { T } = useTheme();
  const p = useMemo(() => makeStyles(T), [T]);
  const [items, setItems] = useState([]);
  const [place, setPlace] = useState('');
  const [start, setStart] = useState(addDays(7));
  const [end, setEnd] = useState(addDays(11));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [packed, setPacked] = useState({});

  React.useEffect(() => { listItems().then(setItems); }, []);

  const run = async () => {
    setBusy(true); setError(null); setResult(null); setPacked({});
    try {
      const where = await geocode(place.trim());
      if (!where) throw new Error(`Could not find ${place.trim()}.`);

      const fc = await getTripForecast(where.lat, where.lon, start, end);
      setForecast({ ...fc, label: where.label });

      const usable = items.filter((i) => i.status !== 'laundry');
      const res = await packList({
        destination: where.label,
        days: fc.days,
        forecast: fc,
        closet: usable.map((i) => ({
          id: i.id, name: i.name, category: i.category, colour: i.colorName,
          material: i.material, formality: i.formality, seasons: i.seasons,
        })),
        occasions: [],
      });
      setResult(res);
    } catch (e) {
      setError(
        e.message?.includes('start_date') || e.status === 400
          ? 'Open-Meteo only forecasts about 16 days out. Pick nearer dates.'
          : e.message || 'Could not build the list.'
      );
    } finally {
      setBusy(false);
    }
  };

  const chosen = result ? result.itemIds.map((id) => items.find((i) => i.id === id)).filter(Boolean) : [];
  const outfitGuess = chosen.length ? Math.max(chosen.length - 2, 1) * 2 : 0;

  return (
    <SafeAreaView style={p.safe} edges={['top', 'bottom']}>
      <View style={p.navBar}>
        <Pressable onPress={() => navigation.goBack()} style={p.backLink} hitSlop={8}>
          <ArrowLeft size={20} color={T.ink} strokeWidth={2} />
          <Text style={p.backText}>Back</Text>
        </Pressable>
        <Text style={p.navTitle}>Travel Capsule Draft</Text>
        <Text style={p.navMeta}>TRIP STITCH</Text>
      </View>

      <ScrollView contentContainerStyle={p.body}>
        <Hint>
          Threadline reads the destination forecast and picks the smallest set from your closet that
          still mixes into a full trip.
        </Hint>

        <View style={{ height: 4 }} />
        <Field label="Destination" value={place} onChangeText={setPlace} placeholder="Lisbon" autoCapitalize="words" />
        <Field label="First day" value={start} onChangeText={setStart} placeholder="YYYY-MM-DD" autoCapitalize="none" />
        <Field label="Last day" value={end} onChangeText={setEnd} placeholder="YYYY-MM-DD" autoCapitalize="none" />
        <Button
          title={busy ? 'Checking the forecast…' : 'Build the list'}
          busy={busy}
          onPress={run}
          disabled={!place.trim()}
        />

        {!!error && <View style={{ marginTop: 14 }}><Banner tone="error">{error}</Banner></View>}

        {forecast && (
          <View style={p.specCard}>
            <Micro>Destination spec</Micro>
            <View style={p.hr} />
            <View style={{ gap: 10 }}>
              <Text style={p.destination}>{forecast.label}</Text>
              <View style={p.dateWeather}>
                <Text style={p.dateText}>
                  {`${shortDate(start)} - ${shortDate(end)} (${forecast.days} DAYS)`}
                </Text>
                <Text style={p.weatherText}>
                  {`${Math.round(forecast.low)}°-${Math.round(forecast.high)}°C${forecast.wetDays ? ` • ${forecast.wetDays} WET` : ''}`}
                </Text>
              </View>
            </View>
          </View>
        )}

        {result && (
          <>
            <View style={p.summaryBar}>
              <Text style={p.summaryText}>
                {`${chosen.length} pieces • ${forecast?.days ?? 0} days • ~${outfitGuess} possible outfits`}
              </Text>
            </View>

            <Micro style={{ marginTop: 16 }}>Capsule checklist</Micro>
            <View style={p.checklist}>
              {chosen.map((i) => {
                const on = !!packed[i.id];
                return (
                  <Pressable
                    key={i.id}
                    style={p.packRow}
                    onPress={() => setPacked((s) => ({ ...s, [i.id]: !s[i.id] }))}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={i.name}
                  >
                    <View style={[p.checkbox, on && p.checkboxOn]}>{on ? <CheckIcon /> : null}</View>
                    {i.imageUri ? (
                      <Image source={{ uri: i.imageUri }} style={p.itemImg} contentFit="contain" />
                    ) : (
                      <View style={[p.itemImg, p.itemImgFallback]}>
                        <Garment category={i.category} color={i.color} size={36} />
                      </View>
                    )}
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={p.itemName} numberOfLines={1}>{i.name}</Text>
                      <Text style={p.itemMeta} numberOfLines={1}>
                        {[i.category, i.material].filter(Boolean).join(' / ') || '—'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {!!result.notes && <Text style={p.notes}>{result.notes}</Text>}
            {!!result.buy?.length && (
              <Text style={p.buy}>Worth buying first: {result.buy.join(', ')}</Text>
            )}
          </>
        )}
      </ScrollView>
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
  backText: { fontFamily: FONTS.sans, fontSize: 14, lineHeight: 18, color: T.ink },
  navTitle: { fontFamily: FONTS.display, fontSize: 18, lineHeight: 24, color: T.ink },
  navMeta: { fontFamily: FONTS.monoSemi, fontSize: 11, lineHeight: 14, color: T.muted },
  body: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 60 },
  specCard: {
    marginTop: 16, backgroundColor: T.card, borderWidth: 1, borderColor: T.seam,
    borderRadius: 8, padding: 16, gap: 12,
  },
  hr: { height: 1, backgroundColor: T.seam },
  destination: { fontFamily: FONTS.display, fontSize: 22, lineHeight: 29, color: T.ink },
  dateWeather: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  dateText: { fontFamily: FONTS.mono, fontSize: 11, lineHeight: 14, color: T.muted },
  weatherText: { fontFamily: FONTS.mono, fontSize: 11, lineHeight: 14, color: T.indigo },
  summaryBar: {
    marginTop: 16, backgroundColor: T.indigo, borderRadius: 6, padding: 12,
  },
  summaryText: { fontFamily: FONTS.sansSemi, fontSize: 14, lineHeight: 18, color: '#fff' },
  checklist: { gap: 10, marginTop: 10 },
  packRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.seam, borderRadius: 8,
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: T.seamDark,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: T.indigo, borderColor: T.indigo },
  itemImg: { width: 48, height: 48, borderRadius: 4 },
  itemImgFallback: { backgroundColor: T.cardArt, alignItems: 'center', justifyContent: 'center' },
  itemName: { fontFamily: FONTS.display, fontSize: 16, lineHeight: 21, color: T.ink },
  itemMeta: { fontFamily: FONTS.mono, fontSize: 11, lineHeight: 14, color: T.muted },
  notes: {
    fontFamily: FONTS.sans, fontSize: 14, lineHeight: 21, color: T.ink, marginTop: 16,
    borderLeftWidth: 2, borderColor: T.indigo, paddingLeft: 12,
  },
  buy: { fontFamily: FONTS.sans, fontSize: 12, color: T.ochre, marginTop: 10 },
});
