import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from 'firebase/auth';
import { onAuth } from '@/services/auth';
import { storage } from '@/services/storage';
import { AppMode } from '@/types';

interface AppContextValue {
  ready: boolean;
  user: User | null;
  mode: AppMode | null;
  onboarded: boolean;
  salonId: string | null;
  ownerId: string | null;
  setMode: (m: AppMode) => Promise<void>;
  clearMode: () => Promise<void>;
  setOnboarded: () => Promise<void>;
  setSalonId: (id: string) => Promise<void>;
  setOwnerId: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [mode, setModeState] = useState<AppMode | null>(null);
  const [onboarded, setOnboardedState] = useState(false);
  const [salonId, setSalonIdState] = useState<string | null>(null);
  const [ownerId, setOwnerIdState] = useState<string | null>(null);

  useEffect(() => {
    let unsubAuth: (() => void) | undefined;
    (async () => {
      const [m, o, s, oid] = await Promise.all([
        storage.getMode(),
        storage.isOnboarded(),
        storage.getSalonId(),
        storage.getOwnerId(),
      ]);
      setModeState(m);
      setOnboardedState(o);
      setSalonIdState(s);
      setOwnerIdState(oid);

      unsubAuth = onAuth((u) => {
        setUser(u);
        setReady(true);
      });
    })();
    return () => {
      unsubAuth?.();
    };
  }, []);

  const setMode = useCallback(async (m: AppMode) => {
    await storage.setMode(m);
    setModeState(m);
  }, []);

  const clearMode = useCallback(async () => {
    await storage.clearMode();
    setModeState(null);
  }, []);

  const setOnboarded = useCallback(async () => {
    await storage.setOnboarded();
    setOnboardedState(true);
  }, []);

  const setSalonId = useCallback(async (id: string) => {
    await storage.setSalonId(id);
    setSalonIdState(id);
  }, []);

  const setOwnerId = useCallback(async (id: string) => {
    await storage.setOwnerId(id);
    setOwnerIdState(id);
  }, []);

  return (
    <AppContext.Provider
      value={{
        ready,
        user,
        mode,
        onboarded,
        salonId,
        ownerId,
        setMode,
        clearMode,
        setOnboarded,
        setSalonId,
        setOwnerId,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
