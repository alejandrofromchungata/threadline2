import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { Button, Micro, Hint } from '../components/ui';
import ChipPicker from '../components/ChipPicker';
import { setSetting } from '../db';
import { STYLES, CONTEXTS, FONTS } from '../theme';
import { useTheme } from '../ThemeContext';

function NeedleIcon({ color, size = 60 }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path d="M6 18l9-13" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M15 5l2 1-1 2" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={7} cy={17} r={1.6} stroke={color} strokeWidth={1.2} fill="none" />
    </Svg>
  );
}

function CameraIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={20} height={20}>
      <Path d="M4 8h3l2-3h6l2 3h3v11H4V8Z" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={12} cy={13} r={3.5} stroke="#fff" strokeWidth={2} fill="none" />
    </Svg>
  );
}

function PencilIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={20} height={20}>
      <Path d="M4 20l1-4 12-12 3 3-12 12-4 1Z" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Line x1={14} y1={5} x2={17} y2={8} stroke="#fff" strokeWidth={2} />
    </Svg>
  );
}

export default function OnboardingScreen({ navigation, onDone }) {
  const { T } = useTheme();
  const o = useMemo(() => makeStyles(T), [T]);
  const [step, setStep] = useState(-1);
  const [styles, setStyles] = useState([]);
  const [contexts, setContexts] = useState([]);
  const [customStyles, setCustomStyles] = useState([]);
  const [customContexts, setCustomContexts] = useState([]);
  const [saving, setSaving] = useState(false);

  const toggle = (list, set, v) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const finish = async (initialMode) => {
    setSaving(true);
    await setSetting('profile', {
      styles, contexts, customStyles, customContexts,
      createdAt: new Date().toISOString(),
    });
    setSaving(false);
    onDone();
    if (initialMode) navigation.navigate('AddItem', { initialMode });
  };

  if (step === -1) {
    return (
      <SafeAreaView style={o.safe} edges={['top', 'bottom']}>
        <View style={o.welcomeBody}>
          <View style={{ alignItems: 'center', gap: 16 }}>
            <NeedleIcon color={T.indigo} />
            <Text style={o.wordmark}>Threadline</Text>
          </View>
          <View style={o.heroCard}>
            <Micro>Woven in workrooms</Micro>
            <View style={o.hr} />
            <Text style={o.heroTagline}>Turn your real clothes into a system that dresses you.</Text>
            <View style={o.hr} />
            <Micro>Model no. 1.0 · Scale 1/1</Micro>
          </View>
        </View>
        <View style={o.footer}>
          <Button title="Get Started" onPress={() => setStep(0)} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={o.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={o.body}>
        <Micro style={{ color: T.indigo }}>
          {step === 0 ? '01 / STYLE SELECTOR' : step === 1 ? '02 / OCCASION DIAL' : '03 / THE FIRST THREAD'}
        </Micro>

        {step === 0 && (
          <>
            <Text style={o.h2}>What's your style?</Text>
            <Hint style={{ marginTop: 4 }}>Blending is expected. Select all that resonate.</Hint>
            <View style={{ marginTop: 16 }}>
              <ChipPicker
                options={STYLES}
                custom={customStyles}
                selected={styles}
                onToggle={(v) => toggle(styles, setStyles, v)}
                onAddCustom={(v) => {
                  setCustomStyles((c) => [...c, v]);
                  setStyles((c) => [...c, v]);
                }}
                placeholder="Search styles..."
              />
              <Hint style={{ marginTop: 16 }}>* Don't see yours? Type custom tags in any time.</Hint>
            </View>
          </>
        )}

        {step === 1 && (
          <>
            <Text style={o.h2}>Where do you show up?</Text>
            <Hint style={{ marginTop: 4 }}>We filter styling algorithms based on your daily arenas.</Hint>
            <View style={{ marginTop: 16 }}>
              <ChipPicker
                options={CONTEXTS}
                custom={customContexts}
                selected={contexts}
                onToggle={(v) => toggle(contexts, setContexts, v)}
                onAddCustom={(v) => {
                  setCustomContexts((c) => [...c, v]);
                  setContexts((c) => [...c, v]);
                }}
                placeholder="Search occasions & settings..."
              />
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={o.h2}>Add your first piece</Text>
            <Hint style={{ marginTop: 4 }}>
              Start with whatever's nearby — a favorite structured jacket, a simple crisp tee, or your go-to denim.
            </Hint>
            <View style={{ height: 20 }} />

            <Pressable style={o.optionCard} onPress={() => finish('photo')} disabled={saving}>
              <View style={o.optionHeader}>
                <View style={o.optionIcon}><CameraIcon /></View>
                <Text style={o.optionTitle}>Take a Photo</Text>
              </View>
              <Hint>
                Snap a picture against a flat background. Threadline isolates the item, reads what it is, and files it.
              </Hint>
            </Pressable>

            <Pressable style={o.optionCard} onPress={() => finish('search')} disabled={saving}>
              <View style={o.optionHeader}>
                <View style={o.optionIcon}><PencilIcon /></View>
                <Text style={o.optionTitle}>Describe It</Text>
              </View>
              <Hint>
                Type the brand, material, and colour. Threadline searches the web for the real product.
              </Hint>
            </Pressable>

            <Pressable style={{ marginTop: 20, alignItems: 'center' }} onPress={() => finish(null)}>
              <Micro style={{ color: T.indigo }}>Skip for now, go to Closet</Micro>
            </Pressable>
          </>
        )}
      </ScrollView>

      {step < 2 && (
        <View style={o.nav}>
          {step > 0 && <Button title="Back" variant="ghost" style={{ flex: 1 }} onPress={() => setStep(step - 1)} />}
          <Button
            title="Next"
            style={{ flex: 1 }}
            disabled={step === 0 && styles.length === 0}
            onPress={() => setStep(step + 1)}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (T) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.paper },
  body: { padding: 24, paddingTop: 24 },
  welcomeBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 40 },
  wordmark: { fontFamily: FONTS.displayBlack, fontSize: 40, color: T.indigo },
  heroCard: {
    width: '100%', backgroundColor: T.card, borderWidth: 1, borderColor: T.seam, borderRadius: 8,
    padding: 24, gap: 16,
  },
  heroTagline: { fontFamily: FONTS.display, fontSize: 22, lineHeight: 29, color: T.ink },
  hr: { height: 1, backgroundColor: T.seam },
  footer: { padding: 24, paddingTop: 12 },
  h2: { fontFamily: FONTS.display, fontSize: 30, color: T.ink, marginTop: 8 },
  optionCard: {
    backgroundColor: T.card, borderWidth: 2, borderColor: T.seam, borderRadius: 12,
    padding: 20, gap: 12, marginBottom: 16,
  },
  optionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: T.indigo,
    alignItems: 'center', justifyContent: 'center',
  },
  optionTitle: { fontFamily: FONTS.display, fontSize: 20, color: T.ink },
  nav: { flexDirection: 'row', gap: 10, padding: 24, paddingTop: 8 },
});
