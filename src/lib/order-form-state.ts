import { defaultDestination, defaultPickup, type LatLng } from "@/lib/hamoula-geo";

/** Local (on-screen) state of the transport request form. */
export type OrderFormValues = {
  pickup: string;
  destination: string;
  cargo: string;
  capacity: string;
  truck: string;
  /** Kept as a string because it is bound to a text input. */
  price: string;
  pickupPoint: LatLng;
  destinationPoint: LatLng;
};

/** Shape of the stored request the form can restore from. */
export type StoredRequest = {
  pickup: string;
  destination: string;
  cargo: string;
  capacity?: string | undefined;
  truck: string;
  price: number;
  pickupPoint: LatLng;
  destinationPoint: LatLng;
  status: string;
};

/** A brand-new, completely empty request form. */
export function emptyOrderForm(): OrderFormValues {
  return {
    pickup: "",
    destination: "",
    cargo: "",
    capacity: "",
    // Canonical vehicle id (legacy "medium" resolves to the same tier).
    truck: "kontiri",
    price: "",
    pickupPoint: defaultPickup,
    destinationPoint: defaultDestination,
  };
}

/**
 * Initial form values for a mount of the order form.
 *
 * A live draft is restored as-is (navigating away and back must NOT wipe what
 * the user typed), while a published request — anything whose status left
 * "draft" — never leaks into the next request.
 */
export function orderFormFromRequest(request: StoredRequest | null | undefined): OrderFormValues {
  const empty = emptyOrderForm();
  if (!request || request.status !== "draft") return empty;
  const bothCities = Boolean(request.pickup && request.destination);
  return {
    pickup: request.pickup ?? "",
    destination: request.destination ?? "",
    cargo: request.cargo ?? "",
    capacity: request.capacity ?? "",
    truck: request.truck || empty.truck,
    price: bothCities ? String(request.price) : "",
    pickupPoint: request.pickupPoint ?? empty.pickupPoint,
    destinationPoint: request.destinationPoint ?? empty.destinationPoint,
  };
}

/** Patch written to the store when the form is cleared ("طلب جديد" / after publish). */
export function resetRequestPatch() {
  const empty = emptyOrderForm();
  return {
    pickup: "",
    destination: "",
    cargo: "",
    capacity: "",
    truck: empty.truck,
    price: 0,
    pickupPoint: empty.pickupPoint,
    destinationPoint: empty.destinationPoint,
    voiceNote: null,
    status: "draft" as const,
    acceptedOffer: null,
  };
}
