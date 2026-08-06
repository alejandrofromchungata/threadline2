import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Garment from '../components/Garment';
import { Button, Chip, Row, Stitch, Micro, Hint } from '../components/ui';
import { getItem, updateItem, deleteItem } from '../db';
import { deleteImage } from '../services/images';
import { T, STATUS, FORMALITY } from '../theme';

export default function ItemDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const [item, setItem] = useState(null);

  useEffect(() => { getItem(id).then(setItem); }, [id]);

  if (!item) return <SafeAreaView style={d.safe} />;

  const cpw = item.price ? (item.price / Math.max(item.wears, 1)).toFixed(2) : null;

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
      <View style={d.head}>
        <Button title="Back" variant="ghost" onPress={() => navigation.goBack()} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        <View style={d.art}>
          {item.imageUri ? (
            <Image source={{ uri: item.imageUri }} style={{ width: 220, height: 220 }} contentFit="contain" />
          ) : (
            <Garment category={item.category} color={item.color} size={190} />
          )}
        </View>

        <Text style={d.brand}>{item.brand || 'No brand'}</Text>
        <Text style={d.name}>{item.name}</Text>

        <View style={d.specs}>
          <Spec label="Category" value={item.category} />
          <Spec label="Colour" value={item.colorName || '—'} />
          <Spec label="Material" value={item.material || '—'} />
          <Spec label="Formality" value={FORMALITY[item.formality - 1]} />
          <Spec label="Season" value={(item.seasons || []).join(', ') || 'any'} />
          <Spec label="Worn" value={`${item.wears} times`} />
          <Spec label="Cost per wear" value={cpw ? `${cpw}` : '—'} />
          <Spec label="Last worn" value={item.lastWorn || 'never'} />
        </View>

        {!!(item.tags || []).length && (
          <Row style={{ marginTop: 14 }}>
            {item.tags.map((t) => <Chip key={t} small label={t} />)}
          </Row>
        )}

        <Stitch label="STATUS" />
        <Row>
          {Object.entries(STATUS).map(([k, v]) => (
            <Chip key={k} small label={v.label} active={item.status === k} onPress={() => setStatus(k)} />
          ))}
        </Row>
        <Hint style={{ marginTop: 10 }}>
          Only clean pieces are offered when Threadline builds an outfit.
        </Hint>

        <Button title="Remove from closet" variant="danger" style={{ marginTop: 28 }} onPress={confirmDelete} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Spec({ label, value }) {
  return (
    <View style={{ width: '48%', marginBottom: 14 }}>
      <Micro>{label}</Micro>
      <Text style={{ fontSize: 14, color: T.ink }}>{value}</Text>
    </View>
  );
}

const d = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.paper },
  head: { paddingHorizontal: 20, paddingVertical: 8, flexDirection: 'row' },
  art: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 20,
    borderWidth: 1, borderColor: T.seam, borderStyle: 'dashed', borderRadius: 3,
    backgroundColor: T.card, marginBottom: 18,
  },
  brand: { fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: T.muted },
  name: { fontSize: 24, fontWeight: '700', letterSpacing: -0.6, color: T.ink, marginTop: 4, marginBottom: 18 },
  specs: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
});
