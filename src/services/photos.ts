import * as ImagePicker from 'expo-image-picker';

/**
 * Pick a square image from the device library, crop, compress to JPEG,
 * and return a base64 data URI ready for Firestore storage.
 *
 * Quality 0.6 + 1:1 ratio keeps photos around 50-100KB.
 */
export async function pickPhotoSquare(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Permission refusée pour accéder aux photos.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.6,
    base64: true,
  });
  if (result.canceled || !result.assets?.[0]?.base64) return null;
  return `data:image/jpeg;base64,${result.assets[0].base64}`;
}
