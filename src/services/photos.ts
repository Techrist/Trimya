import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

/**
 * Pick a square image from the device library, crop, compress and return
 * a base64 data URI ready for Firestore storage.
 *
 * Firestore impose 1 MB max par document. Un base64 brut de photo
 * smartphone peut facilement dépasser cette limite — on force donc un
 * redimensionnement à MAX_DIMENSION avant de retourner. La compression
 * JPEG à 0.5 + 512×512 garde le payload autour de 30-60 KB, confortable
 * sous la limite doc.
 */

/** Largeur/hauteur max du JPEG final en pixels. */
const MAX_DIMENSION = 512;
/** Qualité JPEG de recompression finale (0-1). */
const JPEG_QUALITY = 0.72;

export async function pickPhotoSquare(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Permission refusée pour accéder aux photos.');
  }
  // Nouveau format expo-image-picker v17 — `MediaTypeOptions.Images` est
  // déprécié depuis le SDK 51. On passe par la chaîne litérale `'images'`
  // qui est l'API stable recommandée.
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.9, // on garde une bonne qualité ici, on recompresse après resize
    base64: false, // on gère nous-mêmes l'encodage pour pouvoir resizer
  });

  const asset = result.assets?.[0];
  if (result.canceled || !asset?.uri) return null;

  // Sur web → Canvas resize. Sur natif, allowsEditing a déjà rogné en 1:1
  // mais l'image peut encore être énorme (4000×4000 depuis un APN) — on
  // devrait utiliser expo-image-manipulator pour un vrai resize natif.
  // En attendant l'intégration, on fait confiance au crop + quality 0.5
  // pour le natif.
  if (Platform.OS === 'web') {
    return await resizeAndEncode(asset.uri, MAX_DIMENSION, JPEG_QUALITY);
  }

  // Natif : on utilise le base64 déjà fourni par le picker si disponible,
  // sinon on le fetch depuis l'URI.
  if (asset.base64) {
    return `data:image/jpeg;base64,${asset.base64}`;
  }
  const res = await fetch(asset.uri);
  const blob = await res.blob();
  return await blobToDataUri(blob);
}

/**
 * Charge une image depuis une URI (blob:, data: ou http:), la redimensionne
 * en gardant le ratio centré sur un carré MAX_DIMENSION × MAX_DIMENSION,
 * et renvoie un data URI JPEG.
 *
 * Web uniquement — sur natif, document / Image / canvas ne sont pas dispo.
 */
async function resizeAndEncode(
  uri: string,
  maxDim: number,
  quality: number,
): Promise<string> {
  // Charge l'image en mémoire
  const img = await loadImage(uri);
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  const dstW = Math.round(srcW * scale);
  const dstH = Math.round(srcH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context indisponible.');
  }
  ctx.drawImage(img, 0, 0, dstW, dstH);
  return canvas.toDataURL('image/jpeg', quality);
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Impossible de charger l\'image.'));
    img.src = uri;
  });
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Lecture image échouée.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}
