import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';

export function useNotificationDeepLink(navRef) {
  const notificationSub = useRef(null);

  useEffect(() => {
    notificationSub.current = Notifications.addNotificationResponseReceivedListener((res) => {
      const screen = res.notification.request.content.data?.screen;
      if (screen && navRef.isReady()) navRef.navigate(screen);
    });
    return () => notificationSub.current?.remove();
  }, [navRef]);
}
