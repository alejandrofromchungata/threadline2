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
import { cutout, tagPhoto, readProduct, tagProduct, findProduct } from '../api';
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
            {[['photo', 'Photo'], ['search', 'Search'], ['link', 'Link'], ['manual', 'By hand']].map(([k, l]) => (
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
          {mode === 'search' && (
            <SearchFlow
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
            // The row id is generated at insert time. pendingId names the image
            // file only — reusing it as the row id collides on a second save.
            await insertItem({ ...draft });
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

/* ── Describe it → search the web → pick a match ─────────── */
function SearchFlow({ itemId, onReady }) {
  const [brand, setBrand] = useState('');
  const [keywords, setKeywords] = useState('');
  const [design, setDesign] = useState('');
  const [shot, setShot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [matches, setMatches] = useState(null);

  const addShot = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!res.canceled && res.assets?.[0]) {
      const prepared = await prepareForUpload(res.assets[0].uri, 900);
      setShot(prepared);
    }
  };

  const shootDesign = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!res.canceled && res.assets?.[0]) {
      const prepared = await prepareForUpload(res.assets[0].uri, 900);
      setShot(prepared);
    }
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    setMatches(null);
    try {
      const res = await findProduct({
        brand: brand.trim(),
        keywords: keywords.trim(),
        design: design.trim(),
        image: shot?.base64,
      });
      if (!res.matches?.length) {
        setError("Nothing solid came back. Add more detail, or enter it by hand below.");
      } else {
        setMatches(res.matches);
      }
    } catch (e) {
      setError(e.message || 'The search failed. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  const choose = async (match) => {
    setBusy(true);
    let imageUri = null;
    let price = match.price;
    // If it found a real product page, pull the official photo and price from it.
    if (match.url) {
      try {
        const product = await readProduct(match.url);
        if (product.image) imageUri = await saveRemoteImage(product.image, itemId);
        if (product.price) price = product.price;
      } catch {
        /* the retailer blocked us — the details from the search still stand */
      }
    }
    setBusy(false);
    onReady({ ...match, price, imageUri, sourceUrl: match.url || null });
  };

  if (matches) {
    return (
      <ScrollView contentContainerStyle={a.body}>
        <Micro>{matches.length} possible {matches.length === 1 ? 'match' : 'matches'}</Micro>
        {matches.map((m, i) => (
          <Pressable
            key={i}
            onPress={() => choose(m)}
            disabled={busy}
            style={({ pressed }) => [a.match, pressed && { opacity: 0.7 }]}
          >
            <View style={[a.swatch, { backgroundColor: m.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={a.matchName}>{m.name}</Text>
              <Text style={a.matchMeta} numberOfLines={1}>
                {[m.brand, m.colorName, m.material].filter(Boolean).join(' · ')}
              </Text>
              <Text style={a.matchSource}>
                {m.confidence === 'high' ? 'Confident' : m.confidence === 'medium' ? 'Likely' : 'Rough guess'}
                {m.source ? ` · ${m.source}` : ''}
                {m.price ? ` · ${m.price}` : ''}
              </Text>
            </View>
          </Pressable>
        ))}
        {busy && <ActivityIndicator color={T.indigo} style={{ marginTop: 16 }} />}
        <Button title="Search again" variant="ghost" style={{ marginTop: 16 }} onPress={() => setMatches(null)} />
        <Button title="None of these — enter by hand" variant="ghost" style={{ marginTop: 8 }} onPress={() => onReady({})} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={a.body} keyboardShouldPersistTaps="handled">
      <Hint>
        Describe the piece and Threadline searches for it online. The more specific the better —
        colour, cut, fit, fabric.
      </Hint>
      <View style={{ height: 14 }} />

      <Field label="Brand, if you know it" value={brand} onChangeText={setBrand} placeholder="Mango" autoCapitalize="words" />
      <Field
        label="Describe it"
        value={keywords}
        onChangeText={setKeywords}
        placeholder="light pink crop top, ribbed, small fit"
        multiline
      />
      <Field
        label="Key design or artwork — skip if plain"
        value={design}
        onChangeText={setDesign}
        placeholder="embroidered cherries on the left chest"
      />

      <Micro>Photo of the design, or the whole piece — optional</Micro>
      {shot ? (
        <View style={a.shotRow}>
          <Image source={{ uri: shot.uri }} style={a.shotThumb} contentFit="cover" />
          <Button title="Remove" variant="ghost" onPress={() => setShot(null)} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <Button title="Take a photo" variant="ghost" style={{ flex: 1 }} onPress={shootDesign} />
          <Button title="Choose one" variant="ghost" style={{ flex: 1 }} onPress={addShot} />
        </View>
      )}

      <Button
        title={busy ? 'Searching the web…' : 'Find it'}
        busy={busy}
        style={{ marginTop: 14 }}
        disabled={!keywords.trim() && !brand.trim() && !shot}
        onPress={run}
      />
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
  segBtnTight: { paddingHorizontal: 2 },
  cameraWrap: {
    margin: 20, height: 360, borderRadius: 3, overflow: 'hidden',
    borderWidth: 1, borderColor: T.seamDark, backgroundColor: '#000',
  },
  guide: {
    position: 'absolute', top: 24, left: 24, right: 24, bottom: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', borderStyle: 'dashed', borderRadius: 2,
  },
  workingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  match: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginTop: 10,
    borderWidth: 1, borderColor: T.seam, borderRadius: 3, backgroundColor: T.card,
  },
  swatch: { width: 34, height: 34, borderRadius: 2, borderWidth: 1, borderColor: T.seam },
  matchName: { fontSize: 14, fontWeight: '600', color: T.ink },
  matchMeta: { fontSize: 12, color: T.muted, marginTop: 2 },
  matchSource: { fontSize: 10, color: T.muted, marginTop: 3, letterSpacing: 0.4, textTransform: 'uppercase' },
  shotRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  shotThumb: { width: 64, height: 64, borderRadius: 2, borderWidth: 1, borderColor: T.seam },
  workingText: { fontSize: 15, color: T.ink, fontWeight: '500' },
  preview: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 16, marginBottom: 10,
    borderWidth: 1, borderColor: T.seam, borderStyle: 'dashed', borderRadius: 3, backgroundColor: T.card,
  },
});
