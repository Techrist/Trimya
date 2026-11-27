import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from 'firebase/auth';
import { onAuth } from '@/services/auth';
import {
  isMagicLinkUrl,
  completeMagicLinkSignIn,
  getStoredMagicLinkTarget,
} from '@/services/emailAuth';
import { storage } from '@/services/storage';
import { applyAppResetIfNeeded } from '@/lib/appReset';
import { AppMode } from '@/types';

interface AppContextValue {
  ready: boolean;
  user: User | null;
  mode: AppMode | null;
  onboarded: boolean;
  salonId: string | null;
  ownerId: string | null;
  /**
   * État du callback magic link :
   *  - idle : rien en cours
   *  - processing : on vient de détecter un sign-in link, on complète
   *  - needEmail : lien ouvert depuis un autre device → on doit redemander
   *    l'email à l'utilisateur dans une UI dédiée
   *  - error : échec (lien expiré, email ne matche pas, etc.)
   */
  magicLinkStatus: 'idle' | 'processing' | 'needEmail' | 'error';
  magicLinkError: string | null;
  /** Cible d'origine du magic link (client|owner), si connue. */
  magicLinkTarget: 'client' | 'owner' | null;
  /** Complète la connexion magic link avec un email fourni par l'UI. */
  completeMagicLinkWithEmail: (email: string) => Promise<void>;
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
  const [magicLinkStatus, setMagicLinkStatus] = useState<
    'idle' | 'processing' | 'needEmail' | 'error'
  >('idle');
  const [magicLinkError, setMagicLinkError] = useState<string | null>(null);
  const [magicLinkTarget, setMagicLinkTarget] = useState<
    'client' | 'owner' | null
  >(null);

  useEffect(() => {
    let unsubAuth: (() => void) | undefined;
    (async () => {
      // Réinitialisation globale (déconnexion + vidage local) si la version a changé.
      await applyAppResetIfNeeded();
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

      // ─── Magic link callback ────────────────────────────
      // Si l'URL actuelle est un sign-in link Firebase (?apiKey=...&oobCode=...),
      // on tente de compléter la connexion AVANT d'exposer `ready` au navigator.
      // Ça garantit que le user Firebase est déjà settlé quand RootNavigator
      // calcule initialRoute, et évite un flash "ClientSignIn → ClientTabs".
      if (isMagicLinkUrl()) {
        setMagicLinkStatus('processing');
        setMagicLinkTarget(getStoredMagicLinkTarget());
        try {
          await completeMagicLinkSignIn();
          setMagicLinkStatus('idle');
        } catch (err: any) {
          if (err?.message === 'NEED_EMAIL') {
            // L'utilisateur a ouvert le lien depuis un autre device — l'email
            // n'est plus en localStorage. On met l'app en mode "needEmail" :
            // RootNavigator affichera un écran qui demande l'email.
            setMagicLinkStatus('needEmail');
          } else {
            setMagicLinkStatus('error');
            setMagicLinkError(err?.message || 'Lien invalide ou expiré.');
          }
        }
      }

      unsubAuth = onAuth((u) => {
        setUser(u);
        setReady(true);
      });
    })();
    return () => {
      unsubAuth?.();
    };
  }, []);

  const completeMagicLinkWithEmail = useCallback(async (email: string) => {
    setMagicLinkStatus('processing');
    try {
      await completeMagicLinkSignIn(email);
      setMagicLinkStatus('idle');
      setMagicLinkError(null);
    } catch (err: any) {
      setMagicLinkStatus('error');
      setMagicLinkError(err?.message || 'Lien invalide ou expiré.');
      throw err;
    }
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
        magicLinkStatus,
        magicLinkError,
        magicLinkTarget,
        completeMagicLinkWithEmail,
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
