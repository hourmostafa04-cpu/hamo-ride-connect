import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const searchMoroccoPlaces = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ query: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data }) => {
    const { autocompleteMorocco } = await import("./places.server");
    try {
      return await autocompleteMorocco(data.query);
    } catch (e) {
      console.error(e);
      return [];
    }
  });

export const resolveMoroccoPlace = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ placeId: z.string().min(1).max(400) }).parse(input))
  .handler(async ({ data }) => {
    const { placeDetails } = await import("./places.server");
    return placeDetails(data.placeId);
  });

export const reverseGeocodePoint = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { reverseGeocode } = await import("./places.server");
    try {
      return { label: await reverseGeocode(data.lat, data.lng) };
    } catch (e) {
      console.error(e);
      return { label: "" };
    }
  });
