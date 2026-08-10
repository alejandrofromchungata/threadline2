import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Stitch, Hint } from '../components/ui';
import ChipPicker from '../components/ChipPicker';
import { setSetting } from '../db';
import { T, STYLES, CONTEXTS } from '../theme';

export default function OnboardingScreen({ navigation, onDone }) {
  const [step, setStep] = useState(0);
  const [styles, setStyles] = useState([]);
  const [contexts, setContexts] = useState([]);
  const [customStyles, setCustomStyles] = useState([]);
  const [customContexts, setCustomContexts] = useState([]);
  const [saving, setSaving] = useState(false);

  const toggle = (list, set, v) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const finish = async (addFirst) => {
    setSaving(true);
    await setSetting('profile', {
      styles, contexts, customStyles, customContexts,
      createdAt: new Date().toISOString(),
    });
    setSaving(false);
    onDone();
    if (addFirst) navigation.navigate('AddItem');
  };

  return (
    <SafeAreaView style={o.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={o.body}>
        <View style={o.needle} />
        <Text style={o.title}>Threadline</Text>
        <Text style={o.lede}>Your closet, catalogued. Then it dresses you.</Text>

        <Stitch label={`STEP ${step + 1} OF 3`} />

        {step === 0 && (
          <>
            <Text style={o.h2}>What do you actually wear?</Text>
            <Hint>Pick as many as fit. Blends are normal.</Hint>
            <View style={{ marginTop: 14 }}>
              <ChipPicker
                options={STYLES}
                custom={customStyles}
                selected={styles}
                onToggle={(v) => toggle(styles, setStyles, v)}
                onAddCustom={(v) => {
                  setCustomStyles((c) => [...c, v]);
                  setStyles((c) => [...c, v]);
                }}
                placeholder="Search styles, or add your own"
              />
            </View>
          </>
        )}

        {step === 1 && (
          <>
            <Text style={o.h2}>Where do you have to show up?</Text>
            <Hint>This sets the bar for what counts as appropriate.</Hint>
            <View style={{ marginTop: 14 }}>
              <ChipPicker
                options={CONTEXTS}
                custom={customContexts}
                selected={contexts}
                onToggle={(v) => toggle(contexts, setContexts, v)}
                onAddCustom={(v) => {
                  setCustomContexts((c) => [...c, v]);
                  setContexts((c) => [...c, v]);
                }}
                placeholder="Search settings, or add your own"
              />
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={o.h2}>Hang up your first piece</Text>
            <Hint>
              Photograph something you own and Threadline cuts it out of the background, reads what it is,
              and files it. You can also paste a product link, or type the details yourself.
            </Hint>
            <View style={{ height: 20 }} />
            <Button title="Add my first piece" onPress={() => finish(true)} busy={saving} />
            <Button
              title="Skip for now"
              variant="ghost"
              style={{ marginTop: 10 }}
              onPress={() => finish(false)}
            />
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

const o = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.paper },
  body: { padding: 24, paddingTop: 40 },
  needle: { width: 60, height: 2, backgroundColor: T.indigo, marginBottom: 14 },
  title: { fontSize: 38, fontWeight: '800', letterSpacing: -1.6, color: T.ink },
  lede: { fontSize: 15, color: T.muted, marginTop: 4 },
  h2: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5, color: T.ink, marginBottom: 4 },
  nav: { flexDirection: 'row', gap: 10, padding: 24, paddingTop: 8 },
});
