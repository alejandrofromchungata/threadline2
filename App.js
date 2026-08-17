import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Pressable } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useShareIntent } from 'expo-share-intent';
import { CircleX, Sparkles, CalendarCheck, User, Plus } from 'lucide-react-native';

import { useFonts, PlayfairDisplay_700Bold, PlayfairDisplay_400Regular, PlayfairDisplay_500Medium, PlayfairDisplay_900Black }
  from '@expo-google-fonts/playfair-display';
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold }
  from '@expo-google-fonts/geist';
import { IBMPlexMono_400Regular, IBMPlexMono_600SemiBold }
  from '@expo-google-fonts/ibm-plex-mono';

import ClosetScreen from './src/screens/ClosetScreen';
import OutfitScreen from './src/screens/OutfitScreen';
import LogScreen from './src/screens/LogScreen';
import StyleScreen from './src/screens/StyleScreen';
import AddItemScreen from './src/screens/AddItemScreen';
import ItemDetailScreen from './src/screens/ItemDetailScreen';
import PackingScreen from './src/screens/PackingScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import { getDb, getSetting } from './src/db';
import { FONTS } from './src/theme';
import { ThemeProvider, useTheme } from './src/ThemeContext';

SplashScreen.preventAutoHideAsync().catch(() => {});

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
export const navRef = createNavigationContainerRef();

// Figma names these Lucide icons directly: circle-x, sparkles, calendar-check
// and user, each in a 24pt box at stroke width 2.
const TAB_ICONS = { Closet: CircleX, Outfit: Sparkles, Log: CalendarCheck, Profile: User };

function TabIcon({ name, color }) {
  const Icon = TAB_ICONS[name];
  return Icon ? <Icon size={24} color={color} strokeWidth={2} /> : null;
}

function AddTabButton({ onPress }) {
  const { T } = useTheme();
  const tb = useMemo(() => makeTbStyles(T), [T]);
  return (
    <Pressable onPress={onPress} style={tb.addWrap} accessibilityRole="button" accessibilityLabel="Add a piece">
      <View style={tb.addCircle}>
        <Plus size={24} color="#fff" strokeWidth={2.25} />
      </View>
    </Pressable>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

function AppContent() {
  const { T, isDark } = useTheme();
  const [ready, setReady] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({ resetOnBackground: true });
  const notificationSub = useRef(null);

  const [fontsLoaded] = useFonts({
    PlayfairDisplay_700Bold, PlayfairDisplay_400Regular, PlayfairDisplay_500Medium, PlayfairDisplay_900Black,
    Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold,
    IBMPlexMono_400Regular, IBMPlexMono_600SemiBold,
  });

  const boot = useCallback(async () => {
    await getDb();
    const profile = await getSetting('profile', null);
    setHasProfile(!!profile);
    setReady(true);
  }, []);

  useEffect(() => { boot(); }, [boot]);

  useEffect(() => {
    if (ready && fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [ready, fontsLoaded]);

  // A product shared in from another app lands straight on the import flow.
  useEffect(() => {
    if (!hasShareIntent || !ready || !hasProfile) return;
    const url = shareIntent?.webUrl || shareIntent?.text;
    if (url && navRef.isReady()) {
      navRef.navigate('AddItem', { sharedUrl: url });
      resetShareIntent();
    }
  }, [hasShareIntent, shareIntent, ready, hasProfile, resetShareIntent]);

  // Tapping a laundry reminder opens the Log tab.
  useEffect(() => {
    notificationSub.current = Notifications.addNotificationResponseReceivedListener((res) => {
      const screen = res.notification.request.content.data?.screen;
      if (screen && navRef.isReady()) navRef.navigate(screen);
    });
    return () => notificationSub.current?.remove();
  }, []);

  const app = useMemo(() => makeAppStyles(T), [T]);
  const navTheme = useMemo(() => ({
    dark: isDark,
    colors: {
      primary: T.indigo,
      background: T.paper,
      card: T.card,
      text: T.ink,
      border: T.seam,
      notification: T.rust,
    },
    fonts: {
      regular: { fontFamily: FONTS.sans, fontWeight: '400' },
      medium: { fontFamily: FONTS.sansMedium, fontWeight: '500' },
      bold: { fontFamily: FONTS.sansSemi, fontWeight: '600' },
      heavy: { fontFamily: FONTS.sansBold, fontWeight: '700' },
    },
  }), [T, isDark]);

  if (!ready || !fontsLoaded) {
    return (
      <View style={app.boot}>
        <ActivityIndicator color={T.indigo} />
        <Text style={app.bootText}>Opening the closet…</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NavigationContainer ref={navRef} theme={navTheme}>
        {!hasProfile ? (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Onboarding">
              {(props) => <OnboardingScreen {...props} onDone={() => setHasProfile(true)} />}
            </Stack.Screen>
            <Stack.Screen name="AddItem" component={AddItemScreen} options={{ presentation: 'modal' }} />
          </Stack.Navigator>
        ) : (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Tabs">
              {(props) => <TabsWithReset {...props} onReset={() => setHasProfile(false)} />}
            </Stack.Screen>
            <Stack.Screen name="AddItem" component={AddItemScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="ItemDetail" component={ItemDetailScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Packing" component={PackingScreen} />
          </Stack.Navigator>
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// The Profile tab needs onReset (erase-all-data); pass it through without
// threading extra props into every other tab.
function TabsWithReset({ onReset }) {
  const { T } = useTheme();
  const insets = useSafeAreaInsets();
  const tb = useMemo(() => makeTbStyles(T), [T]);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: T.indigo,
        tabBarInactiveTintColor: T.muted,
        tabBarStyle: [
          tb.bar,
          { height: 68 + insets.bottom, paddingBottom: insets.bottom + 10 },
        ],
        // Figma sets the active tab in Geist 600 and the rest in Geist 500,
        // so the label is rendered directly rather than via tabBarLabelStyle.
        tabBarLabel: ({ focused, color }) => (
          <Text style={[tb.label, { color, fontFamily: focused ? FONTS.sansSemi : FONTS.sansMedium }]}>
            {route.name}
          </Text>
        ),
        tabBarIcon: ({ color }) => <TabIcon name={route.name} color={color} />,
      })}
    >
      <Tab.Screen name="Closet" component={ClosetScreen} />
      <Tab.Screen name="Outfit" component={OutfitScreen} />
      <Tab.Screen
        name="Add"
        component={View}
        options={{ tabBarButton: () => <AddTabButton onPress={() => navRef.isReady() && navRef.navigate('AddItem')} /> }}
        listeners={{ tabPress: (e) => e.preventDefault() }}
      />
      <Tab.Screen name="Log" component={LogScreen} />
      <Tab.Screen name="Profile">
        {(props) => <StyleScreen {...props} onReset={onReset} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

const makeAppStyles = (T) => StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.paper, gap: 12 },
  bootText: { fontFamily: FONTS.sans, fontSize: 13, color: T.muted },
});

const makeTbStyles = (T) => StyleSheet.create({
  bar: { backgroundColor: T.card, borderTopColor: T.seam, paddingTop: 10 },
  label: { fontSize: 10, lineHeight: 13, letterSpacing: 0 },
  addWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', top: -2 },
  addCircle: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: T.indigo,
    alignItems: 'center', justifyContent: 'center',
  },
});
