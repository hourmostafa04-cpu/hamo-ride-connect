/** Google Places (New) + Geocoding access through the Lovable connector gateway. */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

export type PlaceSuggestion = {
  placeId: string;
  main: string;
  secondary: string;
};

export type ResolvedPlace = {
  label: string;
  point: { lat: number; lng: number };
};

function keys() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const maps = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovable || !maps) throw new Error("Google Maps connector is not configured");
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": maps,
  };
}

async function readError(res: Response) {
  const body = await res.text();
  console.error(`Google Maps gateway failed [${res.status}]: ${body}`);
  if (res.status === 403) throw new Error("Google Maps request denied (403).");
  throw new Error(`Google Maps request failed [${res.status}]`);
}

/** Morocco-only autocomplete over cities, douars, neighbourhoods, streets and POIs. */
export async function autocompleteMorocco(input: string): Promise<PlaceSuggestion[]> {
  const q = input.trim().slice(0, 120);
  if (q.length < 2) return [];
  const res = await fetch(`${GATEWAY_URL}/places/v1/places:autocomplete`, {
    method: "POST",
    headers: { ...keys(), "Content-Type": "application/json" },
    body: JSON.stringify({
      input: q,
      includedRegionCodes: ["ma"],
      languageCode: "ar",
      regionCode: "MA",
    }),
  });
  if (!res.ok) await readError(res);
  const data = (await res.json()) as {
    suggestions?: {
      placePrediction?: {
        placeId?: string;
        structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
        text?: { text?: string };
      };
    }[];
  };
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
    .slice(0, 8)
    .map((p) => ({
      placeId: p.placeId!,
      main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondary: p.structuredFormat?.secondaryText?.text ?? "",
    }))
    .filter((p) => p.main);
}

/** Coordinates + readable name for a chosen suggestion. */
export async function placeDetails(placeId: string): Promise<ResolvedPlace> {
  const res = await fetch(
    `${GATEWAY_URL}/places/v1/places/${encodeURIComponent(placeId)}?languageCode=ar`,
    {
      headers: { ...keys(), "X-Goog-FieldMask": "location,displayName,formattedAddress" },
    },
  );
  if (!res.ok) await readError(res);
  const data = (await res.json()) as {
    location?: { latitude: number; longitude: number };
    displayName?: { text?: string };
    formattedAddress?: string;
  };
  if (!data.location) throw new Error("Place has no coordinates");
  return {
    label: data.displayName?.text ?? data.formattedAddress ?? "",
    point: { lat: data.location.latitude, lng: data.location.longitude },
  };
}

/** Readable Moroccan address for GPS coordinates. */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const res = await fetch(
    `${GATEWAY_URL}/maps/api/geocode/json?latlng=${lat},${lng}&language=ar&region=ma`,
    { headers: keys() },
  );
  if (!res.ok) await readError(res);
  const data = (await res.json()) as {
    results?: { formatted_address?: string; address_components?: { long_name: string }[] }[];
  };
  const first = data.results?.[0];
  return first?.formatted_address ?? "";
}
