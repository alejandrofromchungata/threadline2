import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, Linking, Pressable, Switch, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { CircleX, Heart, X } from 'lucide-react-native';
import Garment from '../components/Garment';
import { Button, Chip, Row, Stitch, Hint, Micro } from '../components/ui';
import ChipPicker from '../components/ChipPicker';
import { getSetting, setSetting, wipeAll, recentFeedback, listItems, listWearLog } from '../db';
import { cancelLaundryReminder } from '../services/notifications';
import { exportWardrobeCsv } from '../services/exportCsv';
import { API_BASE } from '../api';
import { STYLES, CONTEXTS, SORTS, FONTS } from '../theme';
import Constants from 'expo-constants';
import { useTheme } from '../ThemeContext';

const TABS = [['preferences', 'Preferences'], ['settings', 'Settings']];

const appVersion = Constants.expoConfig?.version || '1.0.0';
const FEEDBACK_EMAIL = 'alejandrofromchungata@gmail.com';

const APPEARANCE_OPTIONS = [
  ['system', 'Match phone'],
  ['light', 'Light'],
  ['dark', 'Dark'],
];

function NeedleIcon({ color }) {
  return <CircleX size={34} color={color} strokeWidth={2} />;
}

function ReactionBadgeIcon({ up, color }) {
  return up ? <Heart size={12} color={color} strokeWidth={2} /> : <X size={10} color={color} strokeWidth={2} />;
}

/** Figma's settings card: mono caps label, optional caption, dashed rule, rows. */
function SettingsCard({ label, caption, children }) {
  const { T } = useTheme();
  const st = useMemo(() => makeStyles(T), [T]);
  return (
    <View style={st.card}>
      <Micro>{label}</Micro>
      {!!caption && <Text style={st.cardCaption}>{caption}</Text>}
      <View style={st.dashedRule} />
      {children}
    </View>
  );
}

function ToggleRow({ label, value, onValueChange }) {
  const { T } = useTheme();
  const st = useMemo(() => makeStyles(T), [T]);
  return (
    <View style={st.settingRow}>
      <Text style={st.settingLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: T.seam, true: T.indigo }}
        thumbColor="#fff"
        accessibilityLabel={label}
      />
    </View>
  );
}

function ValueRow({ label, value, onPress, pill }) {
  const { T } = useTheme();
  const st = useMemo(() => makeStyles(T), [T]);
  const body = (
    <View style={st.settingRow}>
      <Text style={st.settingLabel}>{label}</Text>
      {pill
        ? <View style={st.valuePill}><Text style={st.valuePillText}>{value}</Text></View>
        : <Text style={[st.settingValue, !!onPress && { color: T.indigo }]}>{value}</Text>}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}, ${value}`}>
      {body}
    </Pressable>
  );
}

export default function StyleScreen({ onReset }) {
  const { T, mode, setMode } = useTheme();
  const st = useMemo(() => makeStyles(T), [T]);
  const [profile, setProfile] = useState({ styles: [], contexts: [], customStyles: [], customContexts: [] });
  const [learned, setLearned] = useState([]);
  const [items, setItems] = useState([]);
  const [wornCount, setWornCount] = useState(0);
  const [editingStyles, setEditingStyles] = useState(false);
  const [editingContexts, setEditingContexts] = useState(false);
  const [tab, setTab] = useState('preferences');
  const [laundryReminders, setLaundryRemindersState] = useState(true);
  const [defaultSort, setDefaultSortState] = useState('recent');
  const [laundryThreshold, setLaundryThresholdState] = useState(8);

  const sortLabel = (SORTS.find(([k]) => k === defaultSort) || SORTS[0])[1];

  const pickSort = () => {
    Alert.alert('Default sort', 'How the closet is ordered when it opens.', [
      ...SORTS.map(([k, label]) => ({
        text: label,
        onPress: async () => { setDefaultSortState(k); await setSetting('defaultSort', k); },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickThreshold = () => {
    Alert.alert('Laundry threshold', 'How many worn pieces before a reminder.', [
      ...[4, 6, 8, 10, 12].map((n) => ({
        text: `${n} worn items`,
        onPress: async () => { setLaundryThresholdState(n); await setSetting('laundryThreshold', n); },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // A mailto: link goes nowhere if no mail account is set up, and the tap would
  // otherwise just do nothing. Show the address so it can still be copied.
  const sendFeedback = async () => {
    const url = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(`Threadline feedback (v${appVersion})`)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('No mail app set up', `Send feedback to ${FEEDBACK_EMAIL}`);
    }
  };

  const exportCsv = async () => {
    try {
      const uri = await exportWardrobeCsv(items);
      await Share.share({ url: uri, title: 'Threadline wardrobe' });
    } catch (e) {
      Alert.alert('Could not export', e.message || 'Something went wrong writing the file.');
    }
  };

  // Persisted so the outfit flow can honour it when it would otherwise
  // schedule a reminder — this toggle changes real behaviour, not just UI.
  const setLaundryReminders = async (on) => {
    setLaundryRemindersState(on);
    await setSetting('laundryReminders', on);
    if (!on) await cancelLaundryReminder();
  };

  const load = useCallback(async () => {
    const [saved, feedback, closet, log] = await Promise.all([
      getSetting('profile', {}), recentFeedback(6), listItems(), listWearLog(500),
    ]);
    setProfile({ styles: [], contexts: [], customStyles: [], customContexts: [], ...saved });
    setLearned(feedback);
    setItems(closet);
    setWornCount(log.length);
    setLaundryRemindersState(await getSetting('laundryReminders', true));
    setDefaultSortState(await getSetting('defaultSort', 'recent'));
    setLaundryThresholdState(await getSetting('laundryThreshold', 8));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async (next) => {
    setProfile(next);
    await setSetting('profile', next);
  };

  const toggle = (key, v) => {
    const list = profile[key] || [];
    save({ ...profile, [key]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] });
  };

  // A custom entry is added to the option list and selected in one go.
  const addCustom = (key, customKey, v) => {
    if ((profile[customKey] || []).includes(v)) return toggle(key, v);
    save({
      ...profile,
      [customKey]: [...(profile[customKey] || []), v],
      [key]: [...(profile[key] || []), v],
    });
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

  const memberSince = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : null;
  const favoriteStyle = profile.styles?.[0]
    ? profile.styles[0].replace(/^\w/, (c) => c.toUpperCase())
    : '—';

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      {/* Figma's nav-bar also carries a Back link, but this screen is a tab
          root — there is nothing to go back to. */}
      <View style={st.navBar}>
        <Text style={st.title}>Style Profile</Text>
        <Micro strong>{tab === 'preferences' ? 'Preferences' : 'Settings'}</Micro>
      </View>

      {/* Same control as the add flow's Photo / Search / Link / Manual. */}
      <View style={st.seg}>
        {TABS.map(([k, label]) => (
          <Pressable
            key={k}
            onPress={() => setTab(k)}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === k }}
            style={[st.segBtn, tab === k && st.segOn]}
          >
            <Text style={[st.segText, tab === k && st.segTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {tab === 'preferences' && (
        <>
        <View style={st.profileHeader}>
          <View style={st.avatar}><NeedleIcon color={T.indigo} /></View>
          <Hint style={{ textAlign: 'center', marginTop: 4 }}>
            These preferences weight every suggestion. Your thumbs up and down adjust them further.
          </Hint>
          {!!memberSince && <Micro style={{ marginTop: 2 }}>{`Member since ${memberSince}`}</Micro>}
        </View>

        <View style={st.statsRow}>
          <View style={st.statCard}>
            <Micro>Total pieces</Micro>
            <Text style={st.statValue}>{items.length}</Text>
          </View>
          <View style={st.statCard}>
            <Micro>Outfits worn</Micro>
            <Text style={st.statValue}>{wornCount}</Text>
          </View>
          <View style={st.statCard}>
            <Micro>Favorite style</Micro>
            <Text style={st.statValue} numberOfLines={1}>{favoriteStyle}</Text>
          </View>
        </View>

        <View style={st.sectionHead}>
          <Micro>Chosen aesthetics</Micro>
          <Pressable onPress={() => setEditingStyles((v) => !v)} hitSlop={8}>
            <Text style={st.editLink}>{editingStyles ? 'Done' : 'Edit'}</Text>
          </Pressable>
        </View>
        {editingStyles ? (
          <ChipPicker
            options={STYLES}
            custom={profile.customStyles || []}
            selected={profile.styles || []}
            onToggle={(v) => toggle('styles', v)}
            onAddCustom={(v) => addCustom('styles', 'customStyles', v)}
            placeholder="Search styles, or add your own"
          />
        ) : (
          <Row>
            {(profile.styles || []).length
              ? profile.styles.map((s) => <Chip key={s} label={s} active onPress={() => setEditingStyles(true)} />)
              : <Hint>None chosen yet — tap Edit to add some.</Hint>}
          </Row>
        )}

        <View style={[st.sectionHead, { marginTop: 20 }]}>
          <Micro>Daily arenas</Micro>
          <Pressable onPress={() => setEditingContexts((v) => !v)} hitSlop={8}>
            <Text style={st.editLink}>{editingContexts ? 'Done' : 'Edit'}</Text>
          </Pressable>
        </View>
        {editingContexts ? (
          <ChipPicker
            options={CONTEXTS}
            custom={profile.customContexts || []}
            selected={profile.contexts || []}
            onToggle={(v) => toggle('contexts', v)}
            onAddCustom={(v) => addCustom('contexts', 'customContexts', v)}
            placeholder="Search settings, or add your own"
          />
        ) : (
          <Row>
            {(profile.contexts || []).length
              ? profile.contexts.map((c) => <Chip key={c} label={c} onPress={() => setEditingContexts(true)} />)
              : <Hint>None chosen yet — tap Edit to add some.</Hint>}
          </Row>
        )}

        {!!learned.length && (
          <>
            <Stitch label="RECENT REACTIONS" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              {learned.map((f) => {
                const firstItem = (f.itemIds || []).map((id) => items.find((i) => i.id === id)).find(Boolean);
                const up = f.verdict === 'up';
                return (
                  <View key={f.id} style={st.reactionCard}>
                    {firstItem?.imageUri ? (
                      <Image source={{ uri: firstItem.imageUri }} style={{ width: 100, height: 120 }} contentFit="cover" />
                    ) : (
                      <View style={st.reactionFallback}>
                        <Garment category={firstItem?.category || 'tops'} color={firstItem?.color} size={56} />
                      </View>
                    )}
                    <View style={[st.reactionBadge, { backgroundColor: up ? T.sage : T.rust }]}>
                      <ReactionBadgeIcon up={up} color="#fff" />
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </>
        )}

        <Stitch label="APPEARANCE" />
        <Row>
          {APPEARANCE_OPTIONS.map(([k, label]) => (
            <Chip key={k} label={label} active={mode === k} onPress={() => setMode(k)} />
          ))}
        </Row>

        </>
        )}

        {tab === 'settings' && (
        <>
        <SettingsCard label="Notifications" caption="Tailored workroom alerts">
          <ToggleRow
            label="Laundry reminders"
            value={laundryReminders}
            onValueChange={setLaundryReminders}
          />
        </SettingsCard>

        <SettingsCard label="Closet">
          <ValueRow label="Default sort" value={sortLabel} onPress={pickSort} pill />
          <ValueRow
            label="Laundry threshold"
            value={`${laundryThreshold} worn items`}
            onPress={pickThreshold}
          />
        </SettingsCard>

        <SettingsCard label="Data management" caption="Everything lives on this phone">
          <Text style={st.privacyText}>
            Your closet, photos and history stay in this app's storage. Photos are sent once
            to {API_BASE ? new URL(API_BASE).host : 'the Threadline service'} for background removal
            and tagging, and are not sold, retained, or used to train anything.
          </Text>
          <Pressable onPress={exportCsv} style={st.dashedBtn} accessibilityRole="button">
            <Text style={st.dashedBtnText}>EXPORT WARDROBE AS CSV</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL('https://yourdomain.example/threadline/privacy')}>
            <Micro style={{ color: T.indigo }}>Plain text privacy policy</Micro>
          </Pressable>
        </SettingsCard>

        <SettingsCard label="About Threadline">
          <ValueRow label="Version" value={appVersion} />
          <ValueRow
            label="Send feedback"
            value="Email"
            onPress={sendFeedback}
          />
        </SettingsCard>

        <Button title="Erase All Local Wardrobe Data" variant="danger" style={{ marginTop: 4 }} onPress={reset} />
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
    paddingHorizontal: 20, paddingVertical: 12,
  },
  seg: {
    flexDirection: 'row', marginHorizontal: 20, backgroundColor: T.card,
    borderWidth: 1, borderColor: T.seam, borderRadius: 100, padding: 4, gap: 2,
    marginVertical: 8,
  },
  segBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 100 },
  segOn: { backgroundColor: T.indigo },
  segText: { fontFamily: FONTS.sansMedium, fontSize: 14, lineHeight: 18, color: T.muted },
  segTextOn: { fontFamily: FONTS.sansSemi, color: '#fff' },
  card: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.seam, borderRadius: 8,
    padding: 16, marginBottom: 16,
  },
  cardCaption: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 17, color: T.muted, marginTop: 2 },
  dashedRule: {
    borderTopWidth: 1, borderColor: T.seam, borderStyle: 'dashed', marginTop: 12, marginBottom: 4,
  },
  valuePill: {
    borderWidth: 1, borderColor: T.seam, backgroundColor: T.paper, borderRadius: 6,
    paddingVertical: 6, paddingHorizontal: 12,
  },
  valuePillText: { fontFamily: FONTS.mono, fontSize: 12, lineHeight: 16, color: T.ink },
  dashedBtn: {
    borderWidth: 1, borderColor: T.indigo, borderStyle: 'dashed', borderRadius: 6,
    paddingVertical: 14, alignItems: 'center', marginTop: 14, marginBottom: 12,
  },
  dashedBtnText: { fontFamily: FONTS.monoSemi, fontSize: 12, lineHeight: 16, color: T.indigo },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, gap: 12,
  },
  settingLabel: { fontFamily: FONTS.sansSemi, fontSize: 15, lineHeight: 20, color: T.ink },
  settingValue: { fontFamily: FONTS.mono, fontSize: 13, lineHeight: 17, color: T.muted },
  title: { fontFamily: FONTS.display, fontSize: 18, lineHeight: 24, color: T.ink },
  profileHeader: { alignItems: 'center', marginBottom: 16 },
  avatar: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: T.card, borderWidth: 1, borderColor: T.seam,
    alignItems: 'center', justifyContent: 'center',
  },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: T.card, borderWidth: 1, borderColor: T.seam, borderRadius: 8,
    padding: 12, gap: 4,
  },
  statValue: { fontFamily: FONTS.display, fontSize: 22, color: T.indigo },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  editLink: { fontFamily: FONTS.sans, fontSize: 13, color: T.indigo },
  reactionCard: {
    width: 100, height: 120, borderRadius: 8, overflow: 'hidden',
    backgroundColor: T.card, borderWidth: 1, borderColor: T.seam,
  },
  reactionFallback: { width: 100, height: 120, alignItems: 'center', justifyContent: 'center' },
  reactionBadge: {
    position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  privacyText: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 18, color: T.muted, marginTop: 8 },
});
