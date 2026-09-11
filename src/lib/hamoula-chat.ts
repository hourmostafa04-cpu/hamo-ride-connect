import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { currentUserId } from "./hamoula-auth";
import { notifyEvent } from "./push-client";

/**
 * Private one-to-one chat between the shipper of a request and the driver who
 * won it. One conversation per request id (load id).
 */

const db = supabase as unknown as SupabaseClient;

export type ChatVoice = { path: string; duration: number; transcript?: string };

export type ChatMessage = {
  id: string;
  loadId: string;
  senderPhone: string;
  senderRole: "shipper" | "driver";
  senderName: string;
  body: string;
  voice: ChatVoice | null;
  createdAt: number;
};

type Row = {
  id: string;
  load_id: string;
  sender_phone: string;
  sender_role: string;
  sender_name: string;
  body: string;
  voice: ChatVoice | null;
  created_at: string;
};

function rowToMessage(r: Row): ChatMessage {
  return {
    id: r.id,
    loadId: r.load_id,
    senderPhone: r.sender_phone,
    senderRole: r.sender_role === "driver" ? "driver" : "shipper",
    senderName: r.sender_name,
    body: r.body,
    voice: r.voice,
    createdAt: new Date(r.created_at).getTime(),
  };
}

/** Oldest → newest messages of one conversation. */
export async function fetchMessages(loadId: string): Promise<ChatMessage[]> {
  const { data, error } = await db
    .from("chat_messages")
    .select("*")
    .eq("load_id", loadId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  return ((data ?? []) as Row[]).map(rowToMessage);
}

/**
 * الإرسال كيمر إجبارياً عبر السيرفر: العميل ما عندو INSERT، والهوية كتتحدد
 * فالسيرفر من auth.uid() — أي اسم/هاتف/دور جاي من العميل كيتجاهل.
 */
export async function sendMessage(input: {
  loadId: string;
  body?: string;
  voice?: ChatVoice | null;
}) {
  const userId = await currentUserId();
  if (!userId) throw new Error("خاصك تكون داخل بحسابك باش تصيفط رسالة");
  await sendChatMessage({
    data: { loadId: input.loadId, body: input.body ?? "", voice: input.voice ?? null },
  });
  notifyEvent("chat", { loadId: input.loadId });
}


/** Live updates for one conversation — no refresh needed. */
export function subscribeMessages(loadId: string, onInsert: (m: ChatMessage) => void) {
  const channel = supabase
    .channel(`chat-${loadId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_messages", filter: `load_id=eq.${loadId}` },
      (payload) => onInsert(rowToMessage(payload.new as Row)),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

/** Upload a recorded blob and return the storage path stored on the message. */
export async function uploadVoice(loadId: string, blob: Blob): Promise<string> {
  const path = `${loadId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.wav`;
  const { error } = await supabase.storage
    .from("chat-voice")
    .upload(path, blob, { contentType: blob.type || "audio/wav", upsert: false });
  if (error) throw error;
  return path;
}

export async function voiceUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("chat-voice").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

/* ---------- unread counter (local, per device) ---------- */

const READ_KEY = "hamoula-chat-read";

function readMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(READ_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

export function markRead(loadId: string, ts = Date.now()) {
  if (typeof window === "undefined") return;
  const map = readMap();
  map[loadId] = ts;
  window.localStorage.setItem(READ_KEY, JSON.stringify(map));
}

export function lastReadAt(loadId: string): number {
  return readMap()[loadId] ?? 0;
}

/** Number of messages in this conversation not written by me and not yet read. */
export async function unreadCount(loadId: string, myPhone: string): Promise<number> {
  const since = new Date(lastReadAt(loadId)).toISOString();
  const { count } = await db
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("load_id", loadId)
    .neq("sender_phone", myPhone)
    .gt("created_at", since);
  return count ?? 0;
}
