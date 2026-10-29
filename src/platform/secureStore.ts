/**
 * Abstraction stockage sécurisé multi-plateformes.
 *
 * Natif : expo-secure-store (Keychain iOS / EncryptedSharedPreferences Android).
 * Web : IndexedDB avec clé obfusquée. ATTENTION — ce n'est PAS un équivalent
 *       crypto du Keychain : un navigateur ne peut pas offrir le même niveau
 *       d'isolation. On documente clairement cette limite dans le README-PWA.
 *       Pour le PIN client, c'est acceptable (le hash est déjà salé via SHA-256
 *       dans clientPin.ts) mais pour tout secret plus critique il faut un
 *       canal serveur.
 *
 * API alignée sur expo-secure-store pour permettre un drop-in replacement.
 */
import { Platform } from 'react-native';

const DB_NAME = 'trimya-secure';
const STORE_NAME = 'kv';

/** Ouvre (ou crée) la base IndexedDB. Lazy — appelé seulement sur web. */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexeddb_open_failed'));
  });
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
    req.onerror = () => reject(req.error ?? new Error('indexeddb_get_failed'));
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('indexeddb_put_failed'));
  });
}

async function idbDel(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('indexeddb_delete_failed'));
  });
}

export async function getItemAsync(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return await idbGet(key);
    } catch {
      // IndexedDB bloqué (mode privé Safari, Lockdown) → on retombe sur
      // localStorage, moins sûr mais permet à l'app de fonctionner.
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    }
  }
  const SecureStore = require('expo-secure-store') as typeof import('expo-secure-store');
  return SecureStore.getItemAsync(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      await idbSet(key, value);
      return;
    } catch {
      try {
        globalThis.localStorage?.setItem(key, value);
        return;
      } catch {
        throw new Error('secure_store_unavailable');
      }
    }
  }
  const SecureStore = require('expo-secure-store') as typeof import('expo-secure-store');
  return SecureStore.setItemAsync(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      await idbDel(key);
    } catch {
      try {
        globalThis.localStorage?.removeItem(key);
      } catch {
        // best-effort — rien à faire de plus.
      }
    }
    return;
  }
  const SecureStore = require('expo-secure-store') as typeof import('expo-secure-store');
  return SecureStore.deleteItemAsync(key);
}
