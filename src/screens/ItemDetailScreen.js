import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ArrowLeft } from 'lucide-react-native';
import Garment from '../components/Garment';
import { Micro } from '../components/ui';
import { getItem, getItemNumber, updateItem, deleteItem } from '../db';
import { deleteImage } from '../services/images';
import { getStatus, formalityDots, FORMALITY, FONTS } from '../theme';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';

const STATUS_ORDER = ['clean', 'dirty', 'laundry', 'storage'];

function BackArrow({ color }) {
  return <ArrowLeft size={20} color={color} strokeWidth={2} />;
}

export default function ItemDetailScreen({ route, navigation }) {
  const { T } = useTheme();
  const d = useMemo(() => makeStyles(T), [T]);
  const { id } = route.params;
  const [item, setItem] = useState(null);
  const [number, setNumber] = useState(null);

  const load = useCallback(() => {
    getItem(id).then(setItem);
    getItemNumber(id).then(setNumber);
  }, [id]);

  // Refetch on focus, so returning from the edit form shows the new values.
  useFocusEffect(load);

  if (!item) return <SafeAreaView style={d.safe} />;

  const cpw = item.price ? (item.price / Math.max(item.wears, 1)).toFixed(2) : null;
  const statusMap = getStatus(T);
  const suitability = (item.seasons || []).map((s) => s[0].toUpperCase()).join(' / ') || '—';
  const formalityLabel = FORMALITY[item.formality - 1] || '';
  const lastWorn = item.lastWorn ? `Last: ${item.lastWorn}` : 'Never worn';

  const setStatus = async (status) => {
    await updateItem(id, { status });
    setItem({ ...item, status });
  };

  const confirmDelete = () => {
    Alert.alert('Remove this piece?', `${item.name} will be deleted from your closet.`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteImage(item.imageUri);
          await deleteItem(id);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={d.safe} edges={['top', 'bottom']}>
      <View style={d.navBar}>
        <Pressable onPress={() => navigation.goBack()} style={d.backLink} hitSlop={8}>
          <BackArrow color={T.ink} />
          <Text style={d.backText}>Closet</Text>
        </Pressable>
        <View style={d.navRight}>
          <Pressable
            onPress={() => navigation.navigate('AddItem', { editId: id })}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Edit this piece"
          >
            <Text style={d.editLink}>Edit</Text>
          </Pressable>
          <Text style={d.catalogNumber}>{`NO. ${String(number || 1).padStart(4, '0')}`}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={d.imageBlock}>
          {item.imageUri ? (
            <Image source={{ uri: item.imageUri }} style={{ width: '100%', height: 280 }} contentFit="contain" />
          ) : (
            <Garment category={item.category} color={item.color} size={190} />
          )}
        </View>

        <View style={d.labelSpecs}>
          <View style={d.detailHeader}>
            <Micro>Garment description</Micro>
            <Text style={d.name}>{item.name}</Text>
          </View>

          <View style={d.divider} />

          <View style={{ gap: 12 }}>
            <View style={d.specRow}>
              <Spec label="Brand" value={item.brand || '—'} />
              <Spec label="Fabric/Comp" value={item.material || '—'} />
            </View>
            <View style={d.specRow}>
              <Spec label="Formality" value={`${formalityDots(item.formality)}${formalityLabel ? ` (${formalityLabel})` : ''}`} />
              <Spec label="Suitability" value={suitability} />
            </View>
            <View style={d.specRow}>
              <Spec label="Wear statistics" value={`${item.wears} wears · ${lastWorn}`} />
              <Spec label="Cost per wear" value={cpw ? `${cpw}${item.price ? ` (${item.price} retail)` : ''}` : '—'} tint={T.indigo} />
            </View>
            {/* Category and colour aren't in the Figma mock, but they're real
                catalogue fields the app already shows — kept in the same spec pattern. */}
            <View style={d.specRow}>
              <Spec label="Category" value={item.category} />
              <Spec label="Colour" value={item.colorName || '—'} />
            </View>
          </View>

          {!!(item.tags || []).length && (
            <View style={d.tagsRow}>
              {item.tags.map((t) => (
                <View key={t} style={d.tagPill}><Text style={d.tagText}>{t}</Text></View>
              ))}
            </View>
          )}

          <View style={d.divider} />

          <View style={{ gap: 8 }}>
            <Micro>Current piece status</Micro>
            <View style={d.segmented}>
              {STATUS_ORDER.map((k) => {
                const active = item.status === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setStatus(k)}
                    style={[d.segment, active && d.segmentOn]}
                  >
                    <Text style={[d.segmentText, active && d.segmentTextOn]}>{statusMap[k].label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={d.statusHint}>Only clean pieces are offered when Threadline builds an outfit.</Text>
          </View>
        </View>
      </ScrollView>

      <View style={d.footer}>
        <View style={d.divider} />
        <Pressable onPress={confirmDelete} style={d.removeBtn}>
          <Text style={d.removeText}>Remove from Closet</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Spec({ label, value, tint }) {
  const { T } = useTheme();
  return (
    <View style={{ width: '48%', gap: 2 }}>
      <Micro>{label}</Micro>
      <Text style={{ fontFamily: FONTS.sansSemi, fontSize: 15, lineHeight: 20, color: tint || T.ink }}>{value}</Text>
    </View>
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
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  editLink: { fontFamily: FONTS.sansSemi, fontSize: 14, lineHeight: 18, color: T.indigo },
  catalogNumber: { fontFamily: FONTS.monoSemi, fontSize: 14, lineHeight: 18, color: T.muted },
  imageBlock: {
    height: 280, alignItems: 'center', justifyContent: 'center', backgroundColor: T.heroBg,
    borderBottomWidth: 1, borderColor: T.seam,
  },
  labelSpecs: { backgroundColor: T.card, padding: 24, gap: 20 },
  detailHeader: { gap: 4 },
  name: { fontFamily: FONTS.display, fontSize: 28, lineHeight: 37, color: T.ink },
  divider: { height: 1, backgroundColor: T.seam },
  specRow: { flexDirection: 'row', justifyContent: 'space-between' },
  segmented: {
    flexDirection: 'row', backgroundColor: T.paper, borderRadius: 8, padding: 4, gap: 2,
  },
  segment: {
    flex: 1, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 6,
  },
  segmentOn: { backgroundColor: T.card, borderWidth: 1, borderColor: T.seam },
  segmentText: { fontFamily: FONTS.sans, fontSize: 13, color: T.muted },
  segmentTextOn: { fontFamily: FONTS.sansSemi, color: T.indigo },
  statusHint: { fontFamily: FONTS.sans, fontSize: 13, color: T.muted, lineHeight: 19, marginTop: 2 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagPill: {
    borderWidth: 1, borderColor: T.seam, backgroundColor: T.card,
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 100,
  },
  tagText: { fontFamily: FONTS.sansMedium, fontSize: 12, color: T.ink },
  footer: { paddingHorizontal: 24, paddingBottom: 20, paddingTop: 12, gap: 12 },
  removeBtn: { height: 44, alignItems: 'center', justifyContent: 'center' },
  removeText: { fontFamily: FONTS.sansSemi, fontSize: 14, color: T.rust },
});
