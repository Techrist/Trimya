import * as Notifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

const IS_EXPO_GO =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Whether this runtime can deliver remote push notifications.
 * - Expo Go on Android: NO (since SDK 53)
 * - Expo Go on iOS: YES (limited)
 * - Standalone / dev build: YES
 */
function canUseRemotePush(): boolean {
  if (IS_EXPO_GO && Platform.OS === 'android') return false;
  return true;
}

/**
 * Request notification permission, retrieve the Expo push token,
 * and persist it on the customer document.
 *
 * Returns null silently in unsupported environments (Expo Go on Android).
 */
export async function registerPushTokenForCustomer(
  customerId: string,
): Promise<string | null> {
  if (!canUseRemotePush()) {
    // Expo Go on Android — skip without touching expo-notifications native APIs.
    return null;
  }

  try {
    const settings = await Notifications.getPermissionsAsync();
    let granted = settings.granted;
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted;
    }
    if (!granted) return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        lightColor: '#FF5722',
        sound: 'default',
      });
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      (Constants as any).easConfig?.projectId;

    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResult.data;
    if (!token) return null;

    await updateDoc(doc(db, 'customers', customerId), {
      pushToken: token,
      pushTokenUpdatedAt: Date.now(),
    });
    return token;
  } catch {
    return null;
  }
}

interface SendPushParams {
  token: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Send a push notification via the Expo Push API.
 * Free, no auth needed for this endpoint.
 */
export async function sendPush(params: SendPushParams): Promise<void> {
  const message = {
    to: params.token,
    sound: 'default',
    title: params.title,
    body: params.body,
    data: params.data || {},
  };

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  if (!res.ok) {
    throw new Error(`Push API error ${res.status}`);
  }
  const json = await res.json();
  if (json.data?.status === 'error') {
    throw new Error(json.data.message || 'Envoi refusé par Expo Push.');
  }
}
