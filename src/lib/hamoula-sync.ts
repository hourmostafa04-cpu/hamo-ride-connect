import { supabase } from "@/integrations/supabase/client";
import type { Bid, Load, TripRequest, TripStatus } from "./hamoula-store";
import type { LatLng } from "./hamoula-geo";
import type { Offer, VoiceNote } from "./hamoula-data";
import { currentUserId } from "./hamoula-auth";

/**
 * Shared-backend persistence for requests (loads), driver offers (bids) and
 * unfinished request drafts. Demo/mock rows stay local-only.
 */

export const isRealLoad = (id: string) => !id.startsWith("demo-");
export const isRealBid = (driverId: string) => !driverId.startsWith("mock-");

type LoadRow = {
  id: string;
  shipper: string;
  shipper_phone: string | null;
  pickup: string;
  destination: string;
  cargo: string;
  pickup_point: LatLng;
  destination_point: LatLng;
  truck: string;
  capacity: string | null;
  price: number;
  voice_note: VoiceNote | null;
  status: string;
  trip_status: string;
  accepted_offer: Offer | null;
  created_at: string;
};

type BidRow = {
  id: string;
  load_id: string;
  driver_id: string;
  driver: string;
  driver_phone: string | null;
  truck: string;
  plate: string;
  rating: number;
  trips: number;
  price: number;
  eta_min: number;
  kind: string;
  voice_note: VoiceNote | null;
  shipper_reply: VoiceNote | null;
  status: string;
  created_at: string;
};

function rowToLoad(r: LoadRow): Load {
  return {
    id: r.id,
    shipper: r.shipper,
    shipperPhone: r.shipper_phone ?? undefined,
    pickup: r.pickup,
    destination: r.destination,
    cargo: r.cargo,
    pickupPoint: r.pickup_point,
    destinationPoint: r.destination_point,
    truck: r.truck,
    price: r.price,
    voiceNote: r.voice_note,
    createdAt: new Date(r.created_at).getTime(),
    status: r.status === "assigned" ? "assigned" : "open",
    tripStatus: r.trip_status as TripStatus,
    acceptedOffer: r.accepted_offer,
    capacity: r.capacity ?? undefined,
  };
}

function rowToBid(r: BidRow): Bid {
  return {
    id: r.id,
    loadId: r.load_id,
    driverId: r.driver_id,
    driver: r.driver,
    driverPhone: r.driver_phone ?? undefined,
    truck: r.truck,
    plate: r.plate,
    rating: Number(r.rating),
    trips: r.trips,
    price: r.price,
    etaMin: r.eta_min,
    kind: r.kind === "accepted-price" ? "accepted-price" : "counter",
    voiceNote: r.voice_note,
    shipperReply: r.shipper_reply,
    status: (r.status as Bid["status"]) ?? "pending",
    createdAt: new Date(r.created_at).getTime(),
  };
}

/** Read every persisted request + offer (shared board across devices). */
export async function fetchBoard(): Promise<{ loads: Load[]; bids: Bid[] }> {
  const [loads, bids] = await Promise.all([
    supabase.from("loads").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("bids").select("*").order("created_at", { ascending: true }).limit(500),
  ]);
  return {
    loads: ((loads.data ?? []) as unknown as LoadRow[]).map(rowToLoad),
    bids: ((bids.data ?? []) as unknown as BidRow[]).map(rowToBid),
  };
}

export async function saveLoad(load: Load) {
  if (!isRealLoad(load.id)) return;
  const userId = await currentUserId();
  if (!userId) {
    console.error("[hamoula] saveLoad: no authenticated user, load NOT saved", load.id);
    throw new Error("لا يمكن حفظ الطلب بدون تسجيل الدخول");
  }
  const { error } = await supabase.from("loads").insert({
    id: load.id,
    user_id: userId,
    shipper: load.shipper,
    shipper_phone: load.shipperPhone ?? null,
    pickup: load.pickup,
    destination: load.destination,
    cargo: load.cargo,
    pickup_point: load.pickupPoint,
    destination_point: load.destinationPoint,
    truck: load.truck,
    capacity: load.capacity ?? null,
    price: load.price,
    voice_note: load.voiceNote,
    status: load.status,
    trip_status: load.tripStatus ?? "searching",
    accepted_offer: load.acceptedOffer ?? null,
  } as never);
  if (error) {
    console.error("[hamoula] saveLoad failed:", error.message, load.id);
    throw new Error(`فشل حفظ الطلب: ${error.message}`);
  }
}

/**
 * تغيير حالة الرحلة فقط، عبر دالة آمنة فالسيرفر:
 * السائق المقبول = enroute/loaded/delivered، صاحب الطلب = searching/matched/cancelled.
 * ما كاين حتى UPDATE مباشر على الأعمدة الحساسة.
 */
export async function saveLoadStatus(loadId: string, patch: { tripStatus?: TripStatus }) {
  if (!isRealLoad(loadId) || !patch.tripStatus) return;
  const { error } = await supabase.rpc("set_trip_status", {
    _load_id: loadId,
    _status: patch.tripStatus,
  } as never);
  if (error) console.warn("[hamoula] set_trip_status:", error.message);
}

/** تعديل بيانات الطلب العادية من صاحبه فقط (قبل قبول أي عرض). */
export async function updateOwnLoad(
  loadId: string,
  patch: Partial<Pick<Load, "pickup" | "destination" | "cargo" | "truck" | "capacity" | "price">> & {
    pickupPoint?: LatLng;
    destinationPoint?: LatLng;
  },
) {
  if (!isRealLoad(loadId)) return;
  const { error } = await supabase.rpc("update_own_load", {
    _load_id: loadId,
    _pickup: patch.pickup ?? null,
    _destination: patch.destination ?? null,
    _cargo: patch.cargo ?? null,
    _truck: patch.truck ?? null,
    _capacity: patch.capacity ?? null,
    _price: patch.price ?? null,
    _pickup_point: patch.pickupPoint ?? null,
    _destination_point: patch.destinationPoint ?? null,
  } as never);
  if (error) throw new Error(error.message);
}

export async function saveBid(bid: Bid) {
  if (!isRealBid(bid.driverId) || !isRealLoad(bid.loadId)) return;
  const userId = await currentUserId();
  if (!userId) return;
  await supabase.from("bids").insert({
    id: bid.id,
    user_id: userId,
    load_id: bid.loadId,
    driver_id: bid.driverId,
    driver: bid.driver,
    driver_phone: bid.driverPhone ?? null,
    truck: bid.truck,
    plate: bid.plate,
    rating: bid.rating,
    trips: bid.trips,
    price: bid.price,
    eta_min: bid.etaMin,
    kind: bid.kind,
    voice_note: bid.voiceNote,
    shipper_reply: bid.shipperReply,
    status: bid.status,
  } as never);
}

/** السائق كيعدّل عرضه هو فقط، وفقط ما دام pending — بلا أي مساس بالهوية. */
export async function updateOwnBid(
  bidId: string,
  patch: { price?: number; etaMin?: number; voiceNote?: VoiceNote | null },
) {
  const { error } = await supabase.rpc("update_own_bid", {
    _bid_id: bidId,
    _price: patch.price ?? null,
    _eta_min: patch.etaMin ?? null,
    _voice_note: patch.voiceNote ?? null,
  } as never);
  if (error) throw new Error(error.message);
}

/** قبول/رفض عرض من صاحب الطلب فقط — عملية واحدة atomic فالسيرفر. */
export async function respondToBid(bidId: string, decision: "accepted" | "rejected") {
  const { error } = await supabase.rpc("respond_to_bid", {
    _bid_id: bidId,
    _decision: decision,
  } as never);
  if (error) throw new Error(error.message);
}

export async function removeBid(bidId: string) {
  await supabase.from("bids").delete().eq("id", bidId);
}


/** The unfinished request form of one phone number — survives app restarts. */
export async function saveDraft(phone: string, data: Partial<TripRequest>) {
  if (!phone) return;
  const userId = await currentUserId();
  if (!userId) return;
  await supabase
    .from("drafts")
    .upsert({ phone, user_id: userId, data: data as never, updated_at: new Date().toISOString() } as never);
}

export async function fetchDraft(phone: string): Promise<Partial<TripRequest> | null> {
  if (!phone) return null;
  const { data } = await supabase.from("drafts").select("data").eq("phone", phone).maybeSingle();
  return ((data as { data?: Partial<TripRequest> } | null)?.data ?? null) as Partial<TripRequest> | null;
}

export async function clearDraft(phone: string) {
  if (!phone) return;
  await supabase.from("drafts").delete().eq("phone", phone);
}
