import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { ArrowLeft, Link2 } from 'lucide-react-native';
import Slider from '../components/Slider';
import { Button, Field, Hint, Micro, Row, Banner } from '../components/ui';
import Garment from '../components/Garment';
import { cutout, tagPhoto, readProduct, tagProduct, findProduct } from '../api';
import { prepareForUpload, saveCutout, saveRemoteImage, deleteImage } from '../services/images';
import { insertItem, newId } from '../db';
import { CATEGORIES, SEASONS, FORMALITY, FONTS, formalityDots } from '../theme';
import { useTheme } from '../ThemeContext';

const BLANK = {
  name: '', brand: '', category: 'tops', color: '#3E5A74', colorName: '',
  material: '', seasons: ['spring'], formality: 3, tags: [], price: 0,
  imageUri: null, sourceUrl: null,
};

// Figma's confidence-badge: a coloured dot plus a mono label. Green for a
// confident match, amber for likely, neutral grey for a rough guess.
const CONFIDENCE = {
  high: { label: 'Confident', dot: (T) => T.sage },
  medium: { label: 'Likely', dot: (T) => T.ochre },
  low: { label: 'Rough guess', dot: (T) => T.muted },
};

// Figma's colour-grid on the tailor's slip. Drives the fallback garment
// illustration, which previously had no UI at all.
const SWATCHES = [
  '#262322', '#FCFAF5', '#2A3C63', '#4A533C',
  '#A52A2A', '#808080', '#E1C699', '#FAF0E6',
];

const SEARCH_STEPS = [
  'Checking the brand’s own site…',
  'Comparing other retailers…',
  'Reading product pages for photos and price…',
  'Matching colour, cut and details…',
];

export default function AddItemScreen({ navigation, route }) {
  const { T } = useTheme();
  const a = useMemo(() => makeStyles(T), [T]);
  const shared = route.params?.sharedUrl;
  const [mode, setMode] = useState(shared ? 'link' : (route.params?.initialMode || 'photo'));
  const [draft, setDraft] = useState(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [pendingId] = useState(newId());

  // Figma gives each add-flow its own nav-bar wording: the blank manual form
  // stays "Add Garment / MANUAL ENTRY", while a draft parsed from a photo,
  // link or search becomes "Verify Care Label".
  const headerTitle = draft
    ? (manualEntry ? 'Add Garment' : 'Verify Care Label')
    : (mode === 'search' ? 'Search Wardrobe' : 'Add Garment');
  const headerMeta = draft
    ? (manualEntry ? 'MANUAL ENTRY' : null)
    : (mode === 'link' ? 'ADD FLOW' : null);
  const backLabel = draft || mode === 'link' ? 'Back' : 'Closet';

  return (
    <SafeAreaView style={a.safe} edges={['top', 'bottom']}>
      <View style={a.head}>
        <Pressable
          onPress={async () => {
            if (draft) { await deleteImage(draft.imageUri); setDraft(null); setManualEntry(false); }
            else navigation.goBack();
          }}
          style={a.backLink}
          hitSlop={8}
        >
          <ArrowLeft size={20} color={T.ink} strokeWidth={2} />
          <Text style={a.backText}>{backLabel}</Text>
        </Pressable>
        <Text style={a.title}>{headerTitle}</Text>
        {headerMeta ? <Text style={a.headMeta}>{headerMeta}</Text> : null}
      </View>

      {!draft ? (
        <>
          <View style={a.seg}>
            {[['photo', 'Photo'], ['search', 'Search'], ['link', 'Link'], ['manual', 'Manual']].map(([k, l]) => (
              <Pressable
                key={k}
                onPress={() => {
                  if (k === 'manual') { setManualEntry(true); setDraft({ ...BLANK }); }
                  else setMode(k);
                }}
                style={[a.segBtn, mode === k && a.segOn]}
              >
                <Text style={[a.segText, mode === k && a.segTextOn]}>{l}</Text>
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
            setManualEntry(false);
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
  const { T } = useTheme();
  const a = useMemo(() => makeStyles(T), [T]);
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState('idle');
  const [error, setError] = useState(null);
  const camera = useRef(null);

  const process = async (uri) => {
    const t0 = Date.now();
    try {
      setError(null);
      setStage('cutting');
      console.log('[timing] prepareForUpload: start');
      const { base64 } = await prepareForUpload(uri);
      console.log(`[timing] prepareForUpload: ${Date.now() - t0}ms, base64 length ${base64.length}`);

      // Cutting out the background and reading the garment don't depend on
      // each other — running them at the same time instead of one after the
      // other roughly halves the wait.
      const tParallel = Date.now();
      const [{ pngBase64 }, fields] = await Promise.all([
        cutout(base64).then((r) => {
          console.log(`[timing] cutout: ${Date.now() - tParallel}ms`);
          return r;
        }),
        tagPhoto(base64, 'image/jpeg')
          .then((r) => {
            console.log(`[timing] tagPhoto: ${Date.now() - tParallel}ms`);
            return r;
          })
          .catch(() => {
            console.log(`[timing] tagPhoto: FAILED after ${Date.now() - tParallel}ms`);
            setError('Saved the cut-out, but auto-tagging failed. Fill in the details below.');
            return {};
          }),
      ]);
      const tSave = Date.now();
      const imageUri = await saveCutout(pngBase64, itemId);
      console.log(`[timing] saveCutout: ${Date.now() - tSave}ms`);
      console.log(`[timing] TOTAL photo flow: ${Date.now() - t0}ms`);

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
          Cutting it off the background and reading what it is…
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
  const { T } = useTheme();
  const a = useMemo(() => makeStyles(T), [T]);
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
      <Micro>01 / Enter product URL</Micro>
      <View style={[a.inputBox, { marginTop: 8 }]}>
        <Link2 size={18} color={T.indigo} strokeWidth={2} />
        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="https://www.uniqlo.com/…/merino-crew-neck-sweater"
          placeholderTextColor={T.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={a.inputBoxText}
        />
      </View>
      <Text style={a.linkTip}>
        Tip: you can also share a garment straight to Threadline from any shopping app.
      </Text>
      <Button
        title={busy ? 'Reading the page…' : 'Pull in details'}
        busy={busy}
        onPress={run}
        disabled={!url.trim()}
        style={{ marginTop: 20 }}
      />
      {!!error && <View style={{ marginTop: 14 }}><Banner tone="error">{error}</Banner></View>}
    </ScrollView>
  );
}

/* ── Describe it → search the web → pick a match ─────────── */
function SearchFlow({ itemId, onReady }) {
  const { T } = useTheme();
  const a = useMemo(() => makeStyles(T), [T]);
  const [brand, setBrand] = useState('');
  const [keywords, setKeywords] = useState('');
  const [design, setDesign] = useState('');
  const [shot, setShot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [matches, setMatches] = useState(null);
  const [searchStep, setSearchStep] = useState(0);

  // The search is genuinely multi-step (checking the brand's site, comparing
  // retailers, reading pages) and can take up to 30-45 seconds — cycle through
  // what it's actually doing so the wait reads as progress, not a stuck spinner.
  useEffect(() => {
    if (!busy) { setSearchStep(0); return; }
    const id = setInterval(() => setSearchStep((i) => (i + 1) % SEARCH_STEPS.length), 3200);
    return () => clearInterval(id);
  }, [busy]);

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
    const t0 = Date.now();
    try {
      const res = await findProduct({
        brand: brand.trim(),
        keywords: keywords.trim(),
        design: design.trim(),
        image: shot?.base64,
      });
      console.log(`[timing] findProduct: ${Date.now() - t0}ms, ${res.matches?.length || 0} matches`);
      if (!res.matches?.length) {
        setError("Nothing solid came back. Add more detail, or enter it by hand below.");
      } else {
        setMatches(res.matches);
      }
    } catch (e) {
      console.log(`[timing] findProduct: FAILED after ${Date.now() - t0}ms — ${e.message}`);
      setError(e.message || 'The search failed. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  const choose = async (match) => {
    setBusy(true);
    let imageUri = null;
    let price = match.price;
    const t0 = Date.now();
    // The search already found a real photo for this match — save that first,
    // so a slow or blocked re-fetch below can't cost us a photo we already have.
    if (match.image) {
      const tSave = Date.now();
      try { imageUri = await saveRemoteImage(match.image, itemId); } catch { /* try the live page next */ }
      console.log(`[timing] choose saveRemoteImage: ${Date.now() - tSave}ms`);
    }
    // Only worth visiting the page again if the search didn't already find a
    // photo — that page was just scraped moments ago during the search, so
    // re-visiting it here only to double check the price isn't worth the wait.
    if (!imageUri && match.url) {
      const tFallback = Date.now();
      try {
        const product = await readProduct(match.url);
        if (product.image) imageUri = await saveRemoteImage(product.image, itemId);
        if (product.price) price = product.price;
        console.log(`[timing] choose fallback readProduct: ${Date.now() - tFallback}ms`);
      } catch (e) {
        console.log(`[timing] choose fallback readProduct: FAILED after ${Date.now() - tFallback}ms — ${e.message}`);
      }
    }
    console.log(`[timing] TOTAL choose: ${Date.now() - t0}ms`);
    setBusy(false);
    onReady({ ...match, price, imageUri, sourceUrl: match.url || null });
  };

  if (matches) {
    return (
      <ScrollView contentContainerStyle={a.body}>
        <Text style={a.resultsLbl}>
          {`Candidate matches found (${matches.length})`}
        </Text>
        {matches.map((m, i) => {
          const conf = CONFIDENCE[m.confidence] || CONFIDENCE.low;
          return (
            <Pressable
              key={i}
              onPress={() => choose(m)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={`${m.name}, ${conf.label}`}
              style={({ pressed }) => [a.match, pressed && { opacity: 0.7 }]}
            >
              {m.image ? (
                <Image source={{ uri: m.image }} style={a.matchPhoto} contentFit="cover" />
              ) : (
                <View style={[a.matchPhoto, { backgroundColor: m.color || T.cardArt }]} />
              )}
              <View style={a.matchInfo}>
                <View style={a.brandBar}>
                  <Text style={a.matchBrand} numberOfLines={1}>{m.brand || '—'}</Text>
                  <View style={a.confBadge}>
                    <View style={[a.confDot, { backgroundColor: conf.dot(T) }]} />
                    <Text style={a.confText}>{conf.label}</Text>
                  </View>
                </View>
                <Text style={a.matchName} numberOfLines={1}>{m.name}</Text>
                {!!m.material && <Text style={a.matchMaterial} numberOfLines={1}>{m.material}</Text>}
                <View style={a.priceRow}>
                  <Text style={a.matchPrice}>{m.price ? `${m.price}` : '—'}</Text>
                  <Text style={a.matchSource} numberOfLines={1}>{m.source || 'Retailer link'}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
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
      {busy && <Micro style={{ marginTop: 10, textAlign: 'center' }}>{SEARCH_STEPS[searchStep]}</Micro>}
      {!!error && <View style={{ marginTop: 14 }}><Banner tone="error">{error}</Banner></View>}
    </ScrollView>
  );
}

/* ── Confirm / edit before saving ────────────────────────── */
function DraftForm({ draft, setDraft, onSave, onDiscard }) {
  const { T } = useTheme();
  const a = useMemo(() => makeStyles(T), [T]);
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
    <ScrollView contentContainerStyle={a.draftBody} keyboardShouldPersistTaps="handled">
      <View style={a.preview}>
        {draft.imageUri ? (
          <Image source={{ uri: draft.imageUri }} style={{ width: '100%', height: 220 }} contentFit="contain" />
        ) : (
          <Garment category={draft.category} color={draft.color} size={140} />
        )}
      </View>

      {/* Figma calls this the "tailor's slip": one bordered card holding
          underlined fields rather than a stack of boxed inputs. */}
      <View style={a.slipCard}>
        <Micro>Individual tailor’s slip</Micro>
        <View style={a.slipDivider} />

        <View style={{ gap: 12 }}>
          <SlipField
            label="Garment name *"
            big
            value={draft.name}
            onChangeText={(v) => set('name', v)}
            placeholder="Ribbed knit polo"
          />

          <View style={a.slipRow}>
            <SlipField
              label="Brand"
              style={{ flex: 1 }}
              value={draft.brand}
              onChangeText={(v) => set('brand', v)}
              placeholder="COS"
            />
            <SlipField label="Category" style={{ flex: 1 }} static>
              <Row style={{ gap: 6 }}>
                {CATEGORIES.map((c) => (
                  <SlipChip key={c} label={c} active={draft.category === c} onPress={() => set('category', c)} />
                ))}
              </Row>
            </SlipField>
          </View>

          <SlipField label="Garment swatch colour" static>
            <Row style={{ gap: 8 }}>
              {SWATCHES.map((hex) => (
                <Pressable
                  key={hex}
                  onPress={() => set('color', hex)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: draft.color === hex }}
                  accessibilityLabel={`Swatch ${hex}`}
                  style={[
                    a.swatchDot,
                    { backgroundColor: hex },
                    draft.color === hex && a.swatchDotOn,
                  ]}
                />
              ))}
            </Row>
          </SlipField>

          <SlipField
            label="Colour name"
            value={draft.colorName}
            onChangeText={(v) => set('colorName', v)}
            placeholder="forest green"
          />
          <SlipField
            label="Material composition"
            value={draft.material}
            onChangeText={(v) => set('material', v)}
            placeholder="merino wool"
          />

          <SlipField label="Suitable seasons" static>
            <Row style={{ gap: 6 }}>
              {SEASONS.map((s) => (
                <SlipChip key={s} label={s} active={draft.seasons.includes(s)} onPress={() => toggleSeason(s)} />
              ))}
            </Row>
          </SlipField>

          <SlipField label={`Formality scale (${formalityDots(draft.formality)})`} static>
            <Text style={a.slipValue}>{FORMALITY[draft.formality - 1]}</Text>
            <Slider min={1} max={5} value={draft.formality} onChange={(v) => set('formality', v)} />
          </SlipField>

          <SlipField
            label="Price retail"
            tint={T.indigo}
            value={String(draft.price || '')}
            onChangeText={(v) => set('price', Number(v.replace(/[^0-9.]/g, '')) || 0)}
            keyboardType="decimal-pad"
            placeholder="0"
          />

          {/* Tags aren't in the Figma mock but the app already stores and uses
              them for outfit matching, so they stay in the same slip pattern. */}
          <SlipField
            label="Tags, comma separated"
            value={(draft.tags || []).join(', ')}
            onChangeText={(v) => set('tags', v.split(',').map((t) => t.trim()).filter(Boolean))}
            placeholder="work, comfy"
          />
        </View>
      </View>

      <Button title="Add to Closet" busy={saving} onPress={save} style={{ marginTop: 16 }} />
      <Pressable onPress={onDiscard} style={a.backEdit}>
        <Text style={a.backEditText}>Back to edit</Text>
      </Pressable>
    </ScrollView>
  );
}

/** One underlined row of the tailor's slip: mono label, value, hairline rule. */
function SlipField({ label, children, big, tint, style, static: isStatic, ...input }) {
  const { T } = useTheme();
  const a = useMemo(() => makeStyles(T), [T]);
  return (
    <View style={[{ gap: 4 }, style]}>
      <Text style={a.slipLabel}>{label}</Text>
      {isStatic ? children : (
        <TextInput
          placeholderTextColor={T.muted}
          style={[a.slipInput, big && a.slipInputBig, !!tint && { color: tint }]}
          {...input}
        />
      )}
      <View style={a.slipLine} />
    </View>
  );
}

/** Figma's season/category chip: sits on the card, so it uses the paper fill. */
function SlipChip({ label, active, onPress }) {
  const { T } = useTheme();
  const a = useMemo(() => makeStyles(T), [T]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => [a.slipChip, active && a.slipChipOn, pressed && { opacity: 0.75 }]}
    >
      <Text style={[a.slipChipText, active && a.slipChipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (T) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.paper },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 12,
  },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { fontFamily: FONTS.sans, fontSize: 14, color: T.ink },
  title: { fontFamily: FONTS.display, fontSize: 18, lineHeight: 24, color: T.ink },
  headMeta: { fontFamily: FONTS.monoSemi, fontSize: 11, lineHeight: 14, color: T.muted },
  body: { padding: 20, paddingBottom: 60 },
  seg: {
    flexDirection: 'row', marginHorizontal: 24, backgroundColor: T.card,
    borderWidth: 1, borderColor: T.seam, borderRadius: 100, padding: 4, gap: 2, marginVertical: 8,
  },
  segBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 100 },
  segOn: { backgroundColor: T.indigo },
  segText: { fontFamily: FONTS.sansMedium, fontSize: 14, lineHeight: 18, color: T.muted },
  segTextOn: { fontFamily: FONTS.sansSemi, color: '#fff' },
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
  resultsLbl: {
    fontFamily: FONTS.mono, fontSize: 11, lineHeight: 14, color: T.muted,
    paddingTop: 8, paddingBottom: 8,
  },
  match: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginTop: 12,
    borderWidth: 1, borderColor: T.seam, borderRadius: 8, backgroundColor: T.card,
  },
  matchPhoto: { width: 64, height: 64, borderRadius: 4 },
  matchInfo: { flex: 1, gap: 2 },
  brandBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  matchBrand: { fontFamily: FONTS.sansBold, fontSize: 12, lineHeight: 16, color: T.muted, flexShrink: 1 },
  confBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  confDot: { width: 6, height: 6, borderRadius: 3 },
  confText: { fontFamily: FONTS.mono, fontSize: 10, lineHeight: 13, color: T.ink },
  matchName: { fontFamily: FONTS.display, fontSize: 16, lineHeight: 21, color: T.ink },
  matchMaterial: { fontFamily: FONTS.sans, fontSize: 12, lineHeight: 16, color: T.muted },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  matchPrice: { fontFamily: FONTS.monoSemi, fontSize: 12, lineHeight: 16, color: T.indigo },
  matchSource: { fontFamily: FONTS.sans, fontSize: 11, lineHeight: 14, color: T.muted, flexShrink: 1 },
  shotRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  shotThumb: { width: 64, height: 64, borderRadius: 2, borderWidth: 1, borderColor: T.seam },
  workingText: { fontSize: 15, color: T.ink, fontWeight: '500' },
  // Figma's draft-photo-block: a flat 220pt band in the hero tone.
  preview: {
    height: 220, alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.heroBg, marginHorizontal: -24, marginBottom: 16,
  },
  draftBody: { paddingHorizontal: 24, paddingTop: 0, paddingBottom: 60 },
  // Figma's link input-box: icon + field on one bordered row.
  inputBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.seam, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  inputBoxText: {
    flex: 1, fontFamily: FONTS.sans, fontSize: 14, lineHeight: 18, color: T.ink, padding: 0,
  },
  linkTip: { fontFamily: FONTS.sans, fontSize: 12, lineHeight: 16, color: T.muted, marginTop: 8 },
  slipCard: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.seam, borderRadius: 8,
    padding: 16, gap: 12,
  },
  slipDivider: { height: 1, backgroundColor: T.seam },
  slipRow: { flexDirection: 'row', gap: 16 },
  slipLabel: {
    fontFamily: FONTS.mono, fontSize: 10, lineHeight: 13, color: T.muted,
    textTransform: 'uppercase',
  },
  slipInput: {
    fontFamily: FONTS.sansSemi, fontSize: 15, lineHeight: 20, color: T.ink, padding: 0,
  },
  slipInputBig: { fontSize: 16, lineHeight: 21 },
  slipValue: { fontFamily: FONTS.sansSemi, fontSize: 15, lineHeight: 20, color: T.ink },
  slipLine: { height: 1, backgroundColor: T.seam },
  slipChip: {
    borderWidth: 1, borderColor: T.seam, backgroundColor: T.paper, borderRadius: 100,
    paddingVertical: 6, paddingHorizontal: 14,
  },
  slipChipOn: { backgroundColor: T.indigo },
  slipChipText: { fontFamily: FONTS.sansMedium, fontSize: 12, lineHeight: 16, color: T.ink },
  slipChipTextOn: { fontFamily: FONTS.sansSemi, color: '#fff' },
  swatchDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: T.seam },
  swatchDotOn: { borderWidth: 2, borderColor: T.indigo },
  backEdit: { paddingVertical: 8, alignItems: 'center', marginTop: 12 },
  backEditText: { fontFamily: FONTS.sans, fontSize: 14, lineHeight: 18, color: T.muted },
});
