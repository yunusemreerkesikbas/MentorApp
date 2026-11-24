import { File } from "expo-file-system";
import * as Picker from "expo-image-picker";

export type DevicePhoto = { uri: string; mimeType: string; width: number; height: number };

export async function pickDevicePhoto(source: "camera" | "gallery"): Promise<DevicePhoto | null> {
  const options: Picker.ImagePickerOptions = {
    mediaTypes: ["images"], quality: 0.85, exif: false,
    preferredAssetRepresentationMode: Picker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  };
  if (source === "camera" && !(await Picker.requestCameraPermissionsAsync()).granted) {
    throw new Error("permission");
  }
  const result = source === "camera"
    ? await Picker.launchCameraAsync(options)
    : await Picker.launchImageLibraryAsync(options);
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset?.mimeType || !["image/jpeg", "image/png", "image/webp"].includes(asset.mimeType)) {
    throw new Error("format");
  }
  return { uri: asset.uri, mimeType: asset.mimeType, width: asset.width, height: asset.height };
}

export const devicePhotoSize = (photo: DevicePhoto) => new File(photo.uri).size;

/** RN's fetch sends a `fetch(uri).blob()` body as garbage on Android, so the file goes up natively. */
export async function putDevicePhoto(url: string, photo: DevicePhoto): Promise<boolean> {
  const { status } = await new File(photo.uri).upload(url, { httpMethod: "PUT", headers: { "Content-Type": photo.mimeType } });
  return status >= 200 && status < 300;
}
