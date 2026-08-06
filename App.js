import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useShareIntent } from 'expo-share-intent';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

import ClosetScreen from './src/screens/ClosetScreen';
import OutfitScreen from './src/screens/OutfitScreen';
import LogScreen from './src/screens/LogScreen';
import StyleScreen from './src/screens/StyleScreen';
import AddItemScreen from './src/screens/AddItemScreen';
import ItemDetailScreen from './src/screens/ItemDetailScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import { getDb, getSetting } from './src/db';
import { T } from './src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
export const navRef = createNavigationContainerRef();

function TabIcon({ name, color }) {
  const props = { stroke: color, strokeWidth: 1.6, fill: 'none' };
  const shapes = {
    Closet: (
      <>
        <Rect x={3} y={3} width={7} height={7} {...props} />
        <Rect x={14} y={3} width={7} height={7} {...props} />
        <Rect x={3} y={14} width={7} height={7} {...props} />
        <Rect x={14} y={14} width={7} height={7} {...props} />
      </>
    ),
    Outfit: <Path d="M12 3l4 3-2 2v13H10V8L8 6z" {...props} />,
    Log: (
      <>
        <Rect x={3} y={5} width={18} height={16} {...props} />
        <Path d="M3 10h18M8 3v4M16 3v4" {...props} />
      </>
    ),
    Style: (
      <>
        <Circle cx={12} cy={12} r={8} {...props} />
        <Path d="M12 8v8M8 12h8" {...props} />
      </>
    ),
  };
  return <Svg viewBox="0 0 24 24" width={20} height={20}>{shapes[name]}</Svg>;
}

function Tabs({ onReset }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: T.indigo,
        tabBarInactiveTintColor: T.muted,
        tabBarStyle: { backgroundColor: T.card, borderTopColor: T.seam },
        tabBarLabelStyle: { fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' },
        tabBarIcon: ({ color }) => <TabIcon name={route.name} color={color} />,
      })}
    >
      <Tab.Screen name="Closet" component={ClosetScreen} />
      <Tab.Screen name="Outfit" component={OutfitScreen} />
      <Tab.Screen name="Log" component={LogScreen} />
      <Tab.Screen name="Style">
        {(props) => <StyleScreen {...props} onReset={onReset} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({ resetOnBackground: true });
  const notificationSub = useRef(null);

  const boot = useCallback(async () => {
    await getDb();
    const profile = await getSetting('profile', null);
    setHasProfile(!!profile);
    setReady(true);
    await SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => { boot(); }, [boot]);

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

  if (!ready) {
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
              {(props) => <Tabs {...props} onReset={() => setHasProfile(false)} />}
            </Stack.Screen>
            <Stack.Screen name="AddItem" component={AddItemScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="ItemDetail" component={ItemDetailScreen} options={{ presentation: 'modal' }} />
          </Stack.Navigator>
        )}
      </NavigationContainer>
    </SafeAreaProvider>
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
    regular: { fontFamily: 'System', fontWeight: '400' },
    medium: { fontFamily: 'System', fontWeight: '500' },
    bold: { fontFamily: 'System', fontWeight: '700' },
    heavy: { fontFamily: 'System', fontWeight: '800' },
  },
};

const app = StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.paper, gap: 12 },
  bootText: { fontSize: 13, color: T.muted },
});
