import React from 'react';
import {
  View, Text, Pressable, TextInput, StyleSheet, ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { T, FONTS } from '../theme';

/** Small mono caps label, used as an "eyebrow" above headings and as a divider. */
export function Eyebrow({ children, tone = 'muted', style }) {
  return (
    <Text style={[s.eyebrow, tone === 'indigo' && { color: T.indigo }, style]}>
      {children}
    </Text>
  );
}

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
  const isCircle = variant === 'circle';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.btn,
        isGhost && s.btnGhost,
        isDanger && s.btnDanger,
        isCircle && s.btnCircle,
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

/** Circular icon-only button, matching the quick-action row on the outfit result screen. */
export function IconButton({ children, onPress, tint = T.ink, style }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.75 }, style]}
    >
      {children}
    </Pressable>
  );
}

export function Field({ label, ...props }) {
  return (
    <View style={{ marginBottom: 12 }}>
      {!!label && <Eyebrow style={{ marginBottom: 6 }}>{label}</Eyebrow>}
      <TextInput placeholderTextColor={T.muted} style={s.field} {...props} />
    </View>
  );
}

export function Micro({ children, style }) {
  return <Eyebrow style={style}>{children}</Eyebrow>;
}

export function Hint({ children, style }) {
  return <Text style={[s.hint, style]}>{children}</Text>;
}

export function Row({ children, style }) {
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, style]}>{children}</View>;
}

/** Display heading in Cormorant Garamond, the serif used throughout the design. */
export function Heading({ children, size = 26, style }) {
  return <Text style={[s.heading, { fontSize: size }, style]}>{children}</Text>;
}

/** The bordered "care-label-card" pattern used for weather, calendar, and note blocks. */
export function CareCard({ eyebrow, children, accent, style }) {
  return (
    <View style={[s.careCard, accent && { borderColor: T.indigo }, style]}>
      {!!eyebrow && <Text style={[s.eyebrow, accent && { color: T.indigo }]}>{eyebrow}</Text>}
      {children}
    </View>
  );
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
    <View style={[s.banner, { borderColor: tint, backgroundColor: `${tint}12` }]}>
      <View style={{ flex: 1 }}>{typeof children === 'string' ? <Text style={s.bannerText}>{children}</Text> : children}</View>
      {!!action && <Button title={action} variant="ghost" onPress={onAction} />}
    </View>
  );
}

export const s = StyleSheet.create({
  eyebrow: {
    fontFamily: FONTS.monoSemi, fontSize: 11, letterSpacing: 1.2,
    textTransform: 'uppercase', color: T.muted,
  },

  stitchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  stitchLine: { flex: 1, height: 1, backgroundColor: T.seam },
  stitchLabel: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 1.5, color: T.muted },

  chip: {
    borderWidth: 1, borderColor: T.seam, backgroundColor: T.card,
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 100,
  },
  chipSmall: { paddingVertical: 6, paddingHorizontal: 12 },
  chipOn: { backgroundColor: T.indigo, borderColor: T.indigo },
  chipText: { fontFamily: FONTS.sansMedium, fontSize: 13, color: T.ink },

  btn: {
    backgroundColor: T.indigo, paddingVertical: 15, paddingHorizontal: 20,
    borderRadius: 26, alignItems: 'center', justifyContent: 'center', minHeight: 52,
  },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: T.seam, paddingVertical: 11, minHeight: 44 },
  btnDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: T.rust },
  btnDisabled: { backgroundColor: T.seamDark, borderColor: T.seam },
  btnText: { fontFamily: FONTS.sansSemi, color: '#fff', fontSize: 16 },
  btnCircle: { width: 44, height: 44, borderRadius: 22, minHeight: 0, padding: 0 },

  iconBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: T.card,
    borderWidth: 1, borderColor: T.seam, alignItems: 'center', justifyContent: 'center',
  },

  field: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.seam,
    paddingHorizontal: 14, paddingVertical: 13, fontFamily: FONTS.sans, fontSize: 15,
    color: T.ink, borderRadius: 8,
  },
  hint: { fontFamily: FONTS.sans, fontSize: 13, color: T.muted, lineHeight: 19 },
  heading: { fontFamily: FONTS.display, color: T.ink, letterSpacing: -0.3 },

  careCard: {
    borderWidth: 1, borderColor: T.seam, borderRadius: 8, backgroundColor: T.card,
    padding: 16, gap: 12,
  },

  sheetWrap: { flex: 1, backgroundColor: 'rgba(38,35,34,0.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '88%', backgroundColor: T.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderColor: T.seam,
  },
  sheetTitle: { fontFamily: FONTS.display, fontSize: 20, flex: 1, marginRight: 12, color: T.ink },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderRadius: 8, padding: 14, marginBottom: 14,
  },
  bannerText: { fontFamily: FONTS.sans, fontSize: 13, color: T.ink, lineHeight: 18 },
});
