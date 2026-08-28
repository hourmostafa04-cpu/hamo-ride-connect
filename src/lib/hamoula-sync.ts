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
  const { error } = await supabase.from("loads").upsert({
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
    updated_at: new Date().toISOString(),
  } as never);
  if (error) {
    console.error("[hamoula] saveLoad failed:", error.message, load.id);
    throw new Error(`فشل حفظ الطلب: ${error.message}`);
  }
}

/** Lifecycle update for one request (منشور → مقبول → في الطريق → تم التسليم / ملغى). */
export async function saveLoadStatus(
  loadId: string,
  patch: { tripStatus?: TripStatus; status?: Load["status"]; acceptedOffer?: Offer | null; price?: number },
) {
  if (!isRealLoad(loadId)) return;
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.tripStatus) row["trip_status"] = patch.tripStatus;
  if (patch.status) row["status"] = patch.status;
  if (patch.acceptedOffer !== undefined) row["accepted_offer"] = patch.acceptedOffer;
  if (patch.price !== undefined) row["price"] = patch.price;
  await supabase.from("loads").update(row as never).eq("id", loadId);
}

export async function saveBid(bid: Bid) {
  if (!isRealBid(bid.driverId) || !isRealLoad(bid.loadId)) return;
  const userId = await currentUserId();
  if (!userId) return;
  await supabase.from("bids").upsert({
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
    updated_at: new Date().toISOString(),
  } as never);
}

export async function saveBidStatus(bidId: string, patch: { status?: Bid["status"]; price?: number }) {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status) row["status"] = patch.status;
  if (patch.price !== undefined) row["price"] = patch.price;
  await supabase.from("bids").update(row as never).eq("id", bidId);
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
