import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Garment from './Garment';
import { Sheet, Field, Button, Hint, Micro, Banner, Stitch } from './ui';
import { packList } from '../api';
import { geocode, getTripForecast } from '../services/weather';
import { T } from '../theme';

const addDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export default function PackingSheet({ visible, onClose, items }) {
  const [place, setPlace] = useState('');
  const [start, setStart] = useState(addDays(7));
  const [end, setEnd] = useState(addDays(11));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [forecast, setForecast] = useState(null);

  const run = async () => {
    setBusy(true); setError(null); setResult(null);
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

  return (
    <Sheet visible={visible} title="Pack for a trip" onClose={onClose}>
      <Hint>
        Threadline reads the destination forecast and picks the smallest set from your closet that still
        mixes into a full trip.
      </Hint>
      <View style={{ height: 16 }} />
      <Field label="Destination" value={place} onChangeText={setPlace} placeholder="Lisbon" autoCapitalize="words" />
      <Field label="First day" value={start} onChangeText={setStart} placeholder="YYYY-MM-DD" autoCapitalize="none" />
      <Field label="Last day" value={end} onChangeText={setEnd} placeholder="YYYY-MM-DD" autoCapitalize="none" />
      <Button title={busy ? 'Checking the forecast…' : 'Build the list'} busy={busy} onPress={run} disabled={!place.trim()} />

      {!!error && <View style={{ marginTop: 14 }}><Banner tone="error">{error}</Banner></View>}

      {forecast && (
        <>
          <Stitch label={forecast.label.toUpperCase()} />
          <Micro>{forecast.days} days · {Math.round(forecast.low)}° to {Math.round(forecast.high)}°C · {forecast.wetDays} likely wet days</Micro>
        </>
      )}

      {result && (
        <>
          <View style={p.grid}>
            {chosen.map((i) => (
              <View key={i.id} style={p.cell}>
                {i.imageUri
                  ? <Image source={{ uri: i.imageUri }} style={{ width: 62, height: 62 }} contentFit="contain" />
                  : <Garment category={i.category} color={i.color} size={62} />}
                <Text style={p.name} numberOfLines={2}>{i.name}</Text>
              </View>
            ))}
          </View>
          {!!result.notes && <Text style={p.notes}>{result.notes}</Text>}
          {!!result.buy?.length && (
            <Text style={p.buy}>Worth buying first: {result.buy.join(', ')}</Text>
          )}
        </>
      )}
    </Sheet>
  );
}

const p = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  cell: {
    width: '30%', alignItems: 'center', padding: 8,
    borderWidth: 1, borderColor: T.seam, borderStyle: 'dashed', borderRadius: 2,
  },
  name: { fontSize: 11, textAlign: 'center', color: T.ink, marginTop: 4 },
  notes: { fontSize: 14, lineHeight: 21, color: T.ink, marginTop: 16, borderLeftWidth: 2, borderColor: T.indigo, paddingLeft: 12 },
  buy: { fontSize: 12, color: T.ochre, marginTop: 10 },
});
