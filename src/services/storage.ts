import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppMode } from '@/types';

const KEYS = {
  mode: '@trimya/mode',
  onboarded: '@trimya/onboarded',
  salonId: '@trimya/salonId',
  customerId: '@trimya/customerId',
} as const;

export const storage = {
  async getMode(): Promise<AppMode | null> {
    const v = await AsyncStorage.getItem(KEYS.mode);
    return v === 'client' || v === 'salon' ? v : null;
  },
  async setMode(mode: AppMode): Promise<void> {
    await AsyncStorage.setItem(KEYS.mode, mode);
  },
  async clearMode(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.mode);
  },

  async isOnboarded(): Promise<boolean> {
    return (await AsyncStorage.getItem(KEYS.onboarded)) === '1';
  },
  async setOnboarded(): Promise<void> {
    await AsyncStorage.setItem(KEYS.onboarded, '1');
  },

  async getSalonId(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.salonId);
  },
  async setSalonId(id: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.salonId, id);
  },

  async getCustomerId(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.customerId);
  },
  async setCustomerId(id: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.customerId, id);
  },

  async resetAll(): Promise<void> {
    await AsyncStorage.multiRemove(Object.values(KEYS));
  },
};
