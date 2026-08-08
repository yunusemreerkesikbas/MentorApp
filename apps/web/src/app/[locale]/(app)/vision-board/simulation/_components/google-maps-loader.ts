import { setOptions } from "@googlemaps/js-api-loader";

let loaderConfigured = false;

export function configureGoogleMapsLoader(locale: string): boolean {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) return false;

  if (!loaderConfigured) {
    setOptions({
      key: apiKey,
      v: "weekly",
      language: locale,
      region: "TR",
      authReferrerPolicy: "origin",
    });
    loaderConfigured = true;
  }

  return true;
}

