import { describe, expect, it } from "vitest";
import { defaultDestination, defaultPickup } from "@/lib/hamoula-geo";
import {
  emptyOrderForm,
  orderFormFromRequest,
  resetRequestPatch,
  type StoredRequest,
} from "@/lib/order-form-state";

const draft: StoredRequest = {
  pickup: "الدار البيضاء",
  destination: "مراكش",
  cargo: "زليج",
  capacity: "5 طن",
  truck: "big",
  price: 2400,
  pickupPoint: { lat: 33.5731, lng: -7.5898 },
  destinationPoint: { lat: 31.6295, lng: -7.9811 },
  status: "draft",
};

describe("OrderForm state persistence", () => {
  it("restores a live draft when returning to the page (back then forward)", () => {
    const values = orderFormFromRequest(draft);
    expect(values.pickup).toBe("الدار البيضاء");
    expect(values.destination).toBe("مراكش");
    expect(values.cargo).toBe("زليج");
    expect(values.capacity).toBe("5 طن");
    expect(values.truck).toBe("big");
    expect(values.price).toBe("2400");
    expect(values.pickupPoint).toEqual(draft.pickupPoint);
    expect(values.destinationPoint).toEqual(draft.destinationPoint);
  });

  it("keeps the draft identical across several remounts", () => {
    const first = orderFormFromRequest(draft);
    const second = orderFormFromRequest(draft);
    const third = orderFormFromRequest(draft);
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it("never leaks a published request into the next form", () => {
    for (const status of ["searching", "matched", "enroute", "loaded", "delivered"]) {
      expect(orderFormFromRequest({ ...draft, status })).toEqual(emptyOrderForm());
    }
  });

  it("starts empty when there is no stored request", () => {
    expect(orderFormFromRequest(null)).toEqual(emptyOrderForm());
    expect(orderFormFromRequest(undefined)).toEqual(emptyOrderForm());
  });

  it("hides the stored price until both cities are set", () => {
    expect(orderFormFromRequest({ ...draft, destination: "", price: 2400 }).price).toBe("");
  });

  it("clears every field and the map route on طلب جديد / after publish", () => {
    const patch = resetRequestPatch();
    expect(patch).toMatchObject({
      pickup: "",
      destination: "",
      cargo: "",
      capacity: "",
      truck: "",
      price: 0,
      voiceNote: null,
      status: "draft",
      acceptedOffer: null,
    });
    expect(patch.pickupPoint).toEqual(defaultPickup);
    expect(patch.destinationPoint).toEqual(defaultDestination);
  });

  it("empty form has no distance-bearing state", () => {
    const empty = emptyOrderForm();
    expect(empty.pickup).toBe("");
    expect(empty.destination).toBe("");
    expect(empty.price).toBe("");
  });
});
