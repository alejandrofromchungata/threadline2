import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Pressable } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useShareIntent } from 'expo-share-intent';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

import { useFonts, CormorantGaramond_700Bold, CormorantGaramond_400Regular }
  from '@expo-google-fonts/cormorant-garamond';
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
import OnboardingScreen from './src/screens/OnboardingScreen';
import { getDb, getSetting } from './src/db';
import { T, FONTS } from './src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
export const navRef = createNavigationContainerRef();

/** Icon set matching the Figma tab bar: layers, sparkles, calendar-check, user. */
function TabIcon({ name, color }) {
  const p = { stroke: color, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  const shapes = {
    Closet: (
      <>
        <Path d="M12 3 3 8l9 5 9-5-9-5Z" {...p} />
        <Path d="M3 13l9 5 9-5" {...p} />
      </>
    ),
    Outfit: (
      <Path
        d="M12 3l1.5 3.5L17 8l-3.5 1.5L12 13l-1.5-3.5L7 8l3.5-1.5L12 3ZM19 14l.8 1.8L21.5 16.5l-1.7.7L19 19l-.8-1.8-1.7-.7 1.7-.7L19 14ZM5 15l.6 1.4L7 17l-1.4.6L5 19l-.6-1.4L3 17l1.4-.6L5 15Z"
        {...p}
      />
    ),
    Log: (
      <>
        <Rect x={3.5} y={5} width={17} height={16} rx={2} {...p} />
        <Path d="M3.5 10h17M8 3v4M16 3v4M8.5 14l2 2 4-4" {...p} />
      </>
    ),
    Profile: (
      <>
        <Circle cx={12} cy={8.5} r={3.5} {...p} />
        <Path d="M5 20c1.2-4 4-6 7-6s5.8 2 7 6" {...p} />
      </>
    ),
  };
  return <Svg viewBox="0 0 24 24" width={20} height={20}>{shapes[name]}</Svg>;
}

function AddTabButton({ onPress }) {
  return (
    <Pressable onPress={onPress} style={tb.addWrap} accessibilityRole="button" accessibilityLabel="Add a piece">
      <View style={tb.addCircle}>
        <Svg viewBox="0 0 24 24" width={16} height={16}>
          <Path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
        </Svg>
      </View>
    </Pressable>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({ resetOnBackground: true });
  const notificationSub = useRef(null);

  const [fontsLoaded] = useFonts({
    CormorantGaramond_700Bold, CormorantGaramond_400Regular,
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
      <StatusBar style="dark" />
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
          </Stack.Navigator>
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// The Profile tab needs onReset (erase-all-data); pass it through without
// threading extra props into every other tab.
function TabsWithReset({ onReset }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: T.indigo,
        tabBarInactiveTintColor: T.muted,
        tabBarStyle: tb.bar,
        tabBarLabelStyle: tb.label,
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

const navTheme = {
  dark: false,
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
};

const app = StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.paper, gap: 12 },
  bootText: { fontFamily: FONTS.sans, fontSize: 13, color: T.muted },
});

const tb = StyleSheet.create({
  bar: { backgroundColor: T.card, borderTopColor: T.seam, height: 78, paddingTop: 8 },
  label: { fontFamily: FONTS.sansMedium, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' },
  addWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', top: -2 },
  addCircle: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: T.indigo,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: T.indigo, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
});
