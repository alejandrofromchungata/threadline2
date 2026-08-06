import React from 'react';
import {
  View, Text, Pressable, TextInput, StyleSheet, ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { T } from '../theme';

export function Stitch({ label, style }) {
  return (
    <View style={[s.stitchRow, style]}>
      <View style={s.stitchLine} />
      {!!label && <Text style={s.stitchLabel}>{label}</Text>}
      <View style={s.stitchLine} />
    </View>
  );
}

export function Chip({ label, active, onPress, small }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => [
        s.chip,
        small && s.chipSmall,
        active && s.chipOn,
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text style={[s.chipText, small && { fontSize: 12 }, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function Button({ title, onPress, disabled, busy, variant = 'primary', style }) {
  const isGhost = variant === 'ghost';
  const isDanger = variant === 'danger';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.btn,
        isGhost && s.btnGhost,
        isDanger && s.btnDanger,
        (disabled || busy) && s.btnDisabled,
        pressed && { opacity: 0.82 },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={isGhost || isDanger ? T.ink : '#fff'} size="small" />
      ) : (
        <Text style={[s.btnText, (isGhost || isDanger) && { color: isDanger ? T.rust : T.ink }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({ label, ...props }) {
  return (
    <View style={{ marginBottom: 12 }}>
      {!!label && <Text style={s.micro}>{label}</Text>}
      <TextInput
        placeholderTextColor="#A9A69C"
        style={s.field}
        {...props}
      />
    </View>
  );
}

export function Micro({ children, style }) {
  return <Text style={[s.micro, style]}>{children}</Text>;
}

export function Hint({ children, style }) {
  return <Text style={[s.hint, style]}>{children}</Text>;
}

export function Row({ children, style }) {
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, style]}>{children}</View>;
}

export function Sheet({ visible, title, onClose, children }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.sheetWrap}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
        <View style={s.sheet}>
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle} numberOfLines={1}>{title}</Text>
            <Button title="Close" variant="ghost" onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function Banner({ tone = 'info', children, action, onAction }) {
  const tint = tone === 'warn' ? T.ochre : tone === 'error' ? T.rust : T.indigo;
  return (
    <View style={[s.banner, { borderColor: tint, backgroundColor: `${tint}14` }]}>
      <View style={{ flex: 1 }}>{typeof children === 'string' ? <Text style={s.bannerText}>{children}</Text> : children}</View>
      {!!action && <Button title={action} variant="ghost" onPress={onAction} />}
    </View>
  );
}

export const s = StyleSheet.create({
  stitchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  stitchLine: { flex: 1, height: 1, borderTopWidth: 1, borderColor: T.seamDark, borderStyle: 'dashed' },
  stitchLabel: { fontSize: 9, letterSpacing: 2, color: T.muted, fontVariant: ['tabular-nums'] },

  chip: {
    borderWidth: 1, borderColor: T.seam, backgroundColor: T.card,
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: 100,
  },
  chipSmall: { paddingVertical: 5, paddingHorizontal: 10 },
  chipOn: { backgroundColor: T.indigo, borderColor: T.indigo },
  chipText: { fontSize: 13, color: T.ink },

  btn: {
    backgroundColor: T.indigo, paddingVertical: 14, paddingHorizontal: 18,
    borderRadius: 2, alignItems: 'center', justifyContent: 'center', minHeight: 48,
  },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: T.seamDark, paddingVertical: 10, minHeight: 44 },
  btnDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: T.rust, borderStyle: 'dashed' },
  btnDisabled: { backgroundColor: T.seamDark, borderColor: T.seam },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  field: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.seam,
    paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: T.ink, borderRadius: 2,
  },
  micro: { fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: T.muted, marginBottom: 6 },
  hint: { fontSize: 13, color: T.muted, lineHeight: 19 },

  sheetWrap: { flex: 1, backgroundColor: 'rgba(26,28,32,0.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '88%', backgroundColor: T.paper, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  sheetHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderColor: T.seam, borderStyle: 'dashed',
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.4, flex: 1, marginRight: 12, color: T.ink },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderRadius: 2, padding: 12, marginBottom: 14,
  },
  bannerText: { fontSize: 13, color: T.ink, lineHeight: 18 },
});
