import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Chip, Button, Row, Stitch, Hint, Micro } from '../components/ui';
import { getSetting, setSetting, wipeAll, recentFeedback } from '../db';
import { API_BASE } from '../api';
import { T, STYLES, CONTEXTS } from '../theme';

export default function StyleScreen({ onReset }) {
  const [profile, setProfile] = useState({ styles: [], contexts: [] });
  const [learned, setLearned] = useState([]);

  const load = useCallback(async () => {
    setProfile(await getSetting('profile', { styles: [], contexts: [] }));
    setLearned(await recentFeedback(6));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async (key, v) => {
    const list = profile[key] || [];
    const next = {
      ...profile,
      [key]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v],
    };
    setProfile(next);
    await setSetting('profile', next);
  };

  const reset = () => {
    Alert.alert(
      'Erase everything?',
      'Your closet, wear history and style profile will be deleted from this phone. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase',
          style: 'destructive',
          onPress: async () => { await wipeAll(); onReset(); },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <Text style={st.title}>Style</Text>
        <Hint style={{ marginTop: 6 }}>
          These weight every suggestion. Your thumbs up and down adjust them further.
        </Hint>

        <Stitch label="STYLES" />
        <Row>
          {STYLES.map((s) => (
            <Chip key={s} label={s} active={profile.styles?.includes(s)} onPress={() => toggle('styles', s)} />
          ))}
        </Row>

        <Stitch label="WHERE YOU SHOW UP" />
        <Row>
          {CONTEXTS.map((s) => (
            <Chip key={s} label={s} active={profile.contexts?.includes(s)} onPress={() => toggle('contexts', s)} />
          ))}
        </Row>

        {!!learned.length && (
          <>
            <Stitch label="RECENT REACTIONS" />
            {learned.map((f) => (
              <View key={f.id} style={st.fbRow}>
                <Text style={[st.fbMark, { color: f.verdict === 'up' ? T.sage : T.rust }]}>
                  {f.verdict === 'up' ? '+' : '–'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={st.fbOcc}>{f.occasion}</Text>
                  <Text style={st.fbItems} numberOfLines={1}>{f.itemNames.join(' + ')}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        <Stitch label="DATA" />
        <Micro>Where things live</Micro>
        <Hint>
          Your closet, photos and history stay in this app's storage on your phone. Photos are sent once
          to {API_BASE ? new URL(API_BASE).host : 'the Threadline service'} for background removal and tagging,
          and are not retained there.
        </Hint>
        <Button
          title="Privacy policy"
          variant="ghost"
          style={{ marginTop: 12 }}
          onPress={() => Linking.openURL('https://yourdomain.example/threadline/privacy')}
        />
        <Button title="Erase all my data" variant="danger" style={{ marginTop: 10 }} onPress={reset} />
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.paper },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.9, color: T.ink },
  fbRow: {
    flexDirection: 'row', gap: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderColor: T.seam, borderStyle: 'dashed',
  },
  fbMark: { fontSize: 18, fontWeight: '700', width: 14 },
  fbOcc: { fontSize: 13, color: T.ink, fontWeight: '500' },
  fbItems: { fontSize: 12, color: T.muted, marginTop: 2 },
});
