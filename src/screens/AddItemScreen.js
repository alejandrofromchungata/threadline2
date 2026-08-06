import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import Slider from '../components/Slider';
import { Button, Chip, Field, Hint, Micro, Row, Stitch, Banner } from '../components/ui';
import Garment from '../components/Garment';
import { cutout, tagPhoto, readProduct, tagProduct } from '../api';
import { prepareForUpload, saveCutout, saveRemoteImage, deleteImage } from '../services/images';
import { insertItem, newId } from '../db';
import { T, CATEGORIES, SEASONS, FORMALITY } from '../theme';

const BLANK = {
  name: '', brand: '', category: 'tops', color: '#3E5A74', colorName: '',
  material: '', seasons: ['spring'], formality: 3, tags: [], price: 0,
  imageUri: null, sourceUrl: null,
};

export default function AddItemScreen({ navigation, route }) {
  const shared = route.params?.sharedUrl;
  const [mode, setMode] = useState(shared ? 'link' : 'photo');
  const [draft, setDraft] = useState(null);
  const [pendingId] = useState(newId());

  return (
    <SafeAreaView style={a.safe} edges={['top', 'bottom']}>
      <View style={a.head}>
        <Text style={a.title}>Add a piece</Text>
        <Button title="Cancel" variant="ghost" onPress={() => navigation.goBack()} />
      </View>

      {!draft ? (
        <>
          <View style={a.seg}>
            {[['photo', 'Photograph'], ['link', 'From a link'], ['manual', 'By hand']].map(([k, l]) => (
              <Pressable
                key={k}
                onPress={() => (k === 'manual' ? setDraft({ ...BLANK }) : setMode(k))}
                style={[a.segBtn, mode === k && a.segOn]}
              >
                <Text style={[a.segText, mode === k && { color: '#fff' }]}>{l}</Text>
              </Pressable>
            ))}
          </View>

          {mode === 'photo' && (
            <PhotoFlow
              itemId={pendingId}
              onReady={(fields) => setDraft({ ...BLANK, ...fields })}
            />
          )}
          {mode === 'link' && (
            <LinkFlow
              itemId={pendingId}
              initialUrl={shared}
              onReady={(fields) => setDraft({ ...BLANK, ...fields })}
            />
          )}
        </>
      ) : (
        <DraftForm
          draft={draft}
          setDraft={setDraft}
          onDiscard={async () => {
            await deleteImage(draft.imageUri);
            setDraft(null);
          }}
          onSave={async () => {
            await insertItem({ ...draft, id: pendingId });
            navigation.goBack();
          }}
        />
      )}
    </SafeAreaView>
  );
}

/* ── Photograph → cut out → auto-tag ─────────────────────── */
function PhotoFlow({ itemId, onReady }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState('idle');
  const [error, setError] = useState(null);
  const camera = useRef(null);

  const process = async (uri) => {
    try {
      setError(null);
      setStage('cutting');
      const { base64 } = await prepareForUpload(uri);
      const { pngBase64 } = await cutout(base64);
      const imageUri = await saveCutout(pngBase64, itemId);

      setStage('reading');
      let fields = {};
      try {
        fields = await tagPhoto(pngBase64);
      } catch {
        setError('Saved the cut-out, but auto-tagging failed. Fill in the details below.');
      }
      onReady({ ...fields, imageUri });
    } catch (e) {
      setStage('idle');
      setError(e.message || 'Something went wrong with that photo.');
    }
  };

  const shoot = async () => {
    if (!camera.current) return;
    const photo = await camera.current.takePictureAsync({ quality: 0.9, skipProcessing: false });
    await process(photo.uri);
  };

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (!res.canceled && res.assets?.[0]) await process(res.assets[0].uri);
  };

  if (stage !== 'idle') {
    return (
      <View style={a.workingBox}>
        <ActivityIndicator color={T.indigo} />
        <Text style={a.workingText}>
          {stage === 'cutting' ? 'Cutting it off the background…' : 'Reading what it is…'}
        </Text>
        <Hint style={{ textAlign: 'center', marginTop: 6 }}>
          This takes a few seconds on the first photo.
        </Hint>
      </View>
    );
  }

  if (!permission) return <View style={a.workingBox}><ActivityIndicator color={T.indigo} /></View>;

  if (!permission.granted) {
    return (
      <ScrollView contentContainerStyle={a.body}>
        <Banner tone="info">
          Threadline needs the camera to photograph clothing. Nothing is stored outside your phone
          except the single image sent for background removal.
        </Banner>
        <Button title="Allow camera" onPress={requestPermission} />
        <Button title="Choose from photos instead" variant="ghost" style={{ marginTop: 10 }} onPress={pick} />
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={a.cameraWrap}>
        <CameraView ref={camera} style={{ flex: 1 }} facing="back" />
        <View pointerEvents="none" style={a.guide} />
      </View>
      {!!error && <View style={{ paddingHorizontal: 20, paddingTop: 12 }}><Banner tone="error">{error}</Banner></View>}
      <View style={a.body}>
        <Hint>Lay the garment flat on a plain surface, fill the frame, and shoot straight down.</Hint>
        <Button title="Take the photo" style={{ marginTop: 14 }} onPress={shoot} />
        <Button title="Choose from photos" variant="ghost" style={{ marginTop: 10 }} onPress={pick} />
      </View>
    </View>
  );
}

/* ── Product link → scrape → tag ─────────────────────────── */
function LinkFlow({ itemId, initialUrl, onReady }) {
  const [url, setUrl] = useState(initialUrl || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { if (initialUrl) setUrl(initialUrl); }, [initialUrl]);

  const run = async () => {
    const clean = url.trim();
    if (!clean) return;
    setBusy(true);
    setError(null);
    try {
      const product = await readProduct(clean);
      const fields = await tagProduct({
        title: product.title,
        brand: product.brand,
        description: product.description,
        price: product.price,
        url: clean,
      });
      let imageUri = null;
      if (product.image) {
        try { imageUri = await saveRemoteImage(product.image, itemId); } catch { /* keep going */ }
      }
      onReady({
        ...fields,
        price: product.price || fields.price || 0,
        brand: product.brand || fields.brand || '',
        imageUri,
        sourceUrl: clean,
      });
    } catch (e) {
      setError(
        e.status === 422
          ? "That page didn't expose product details. Paste the item name instead, or add it by hand."
          : e.message || 'Could not read that link.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={a.body} keyboardShouldPersistTaps="handled">
      <Hint>
        Paste a product link, or share one to Threadline from any shopping app. Name, brand, price and
        photo come across; the rest is inferred.
      </Hint>
      <View style={{ height: 14 }} />
      <Field
        label="Product link"
        value={url}
        onChangeText={setUrl}
        placeholder="https://www.uniqlo.com/…/merino-crew-neck-sweater"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        multiline
      />
      <Button title={busy ? 'Reading the page…' : 'Pull in details'} busy={busy} onPress={run} disabled={!url.trim()} />
      {!!error && <View style={{ marginTop: 14 }}><Banner tone="error">{error}</Banner></View>}
    </ScrollView>
  );
}

/* ── Confirm / edit before saving ────────────────────────── */
function DraftForm({ draft, setDraft, onSave, onDiscard }) {
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setDraft({ ...draft, [k]: v });
  const toggleSeason = (s) =>
    set('seasons', draft.seasons.includes(s) ? draft.seasons.filter((x) => x !== s) : [...draft.seasons, s]);

  const save = async () => {
    if (!draft.name.trim()) {
      Alert.alert('Name it first', 'Give the piece a short name so you can find it later.');
      return;
    }
    setSaving(true);
    try {
      await onSave();
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', e.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={a.body} keyboardShouldPersistTaps="handled">
      <View style={a.preview}>
        {draft.imageUri ? (
          <Image source={{ uri: draft.imageUri }} style={{ width: 160, height: 160 }} contentFit="contain" />
        ) : (
          <Garment category={draft.category} color={draft.color} size={140} />
        )}
      </View>

      <Field label="Name" value={draft.name} onChangeText={(v) => set('name', v)} placeholder="Ribbed knit polo" />
      <Field label="Brand" value={draft.brand} onChangeText={(v) => set('brand', v)} placeholder="COS" />

      <Micro>Category</Micro>
      <Row style={{ marginBottom: 14 }}>
        {CATEGORIES.map((c) => (
          <Chip key={c} small label={c} active={draft.category === c} onPress={() => set('category', c)} />
        ))}
      </Row>

      <Field label="Colour" value={draft.colorName} onChangeText={(v) => set('colorName', v)} placeholder="forest green" />
      <Field label="Material" value={draft.material} onChangeText={(v) => set('material', v)} placeholder="merino wool" />

      <Micro>Season</Micro>
      <Row style={{ marginBottom: 14 }}>
        {SEASONS.map((s) => (
          <Chip key={s} small label={s} active={draft.seasons.includes(s)} onPress={() => toggleSeason(s)} />
        ))}
      </Row>

      <Micro>{`Formality — ${FORMALITY[draft.formality - 1]}`}</Micro>
      <Slider min={1} max={5} value={draft.formality} onChange={(v) => set('formality', v)} />

      <Field
        label="Tags, comma separated"
        value={(draft.tags || []).join(', ')}
        onChangeText={(v) => set('tags', v.split(',').map((t) => t.trim()).filter(Boolean))}
        placeholder="work, comfy"
      />
      <Field
        label="Price paid"
        value={String(draft.price || '')}
        onChangeText={(v) => set('price', Number(v.replace(/[^0-9.]/g, '')) || 0)}
        keyboardType="decimal-pad"
        placeholder="0"
      />

      <Stitch />
      <Button title="Hang it up" busy={saving} onPress={save} />
      <Button title="Start over" variant="ghost" style={{ marginTop: 10 }} onPress={onDiscard} />
    </ScrollView>
  );
}

const a = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.paper },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 10,
  },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.6, color: T.ink },
  body: { padding: 20, paddingBottom: 60 },
  seg: {
    flexDirection: 'row', marginHorizontal: 20, borderWidth: 1, borderColor: T.seam,
    borderRadius: 2, overflow: 'hidden', marginBottom: 4,
  },
  segBtn: { flex: 1, paddingVertical: 11, alignItems: 'center', backgroundColor: T.card },
  segOn: { backgroundColor: T.indigo },
  segText: { fontSize: 12, color: T.muted },
  cameraWrap: {
    margin: 20, height: 360, borderRadius: 3, overflow: 'hidden',
    borderWidth: 1, borderColor: T.seamDark, backgroundColor: '#000',
  },
  guide: {
    position: 'absolute', top: 24, left: 24, right: 24, bottom: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', borderStyle: 'dashed', borderRadius: 2,
  },
  workingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  workingText: { fontSize: 15, color: T.ink, fontWeight: '500' },
  preview: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 16, marginBottom: 10,
    borderWidth: 1, borderColor: T.seam, borderStyle: 'dashed', borderRadius: 3, backgroundColor: T.card,
  },
});
