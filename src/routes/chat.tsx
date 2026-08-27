import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Mic, Send } from "lucide-react";
import { PhoneFrame, AppHeader, StickyActions } from "@/components/hamoula/PhoneFrame";
import { VoiceRecorderSheet } from "@/components/hamoula/Voice";
import { ChatVoiceBubble } from "@/components/hamoula/ChatVoiceBubble";
import { useHamoula, phoneKey } from "@/lib/hamoula-store";
import {
  fetchMessages,
  markRead,
  sendMessage,
  subscribeMessages,
  uploadVoice,
  type ChatMessage,
} from "@/lib/hamoula-chat";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "المحادثة | حمولة" },
      {
        name: "description",
        content: "محادثة خاصة بين صاحب البضاعة وصاحب الشاحنة: رسائل نصية وصوتية محفوظة ومباشرة.",
      },
      { property: "og:title", content: "المحادثة | حمولة" },
      { property: "og:description", content: "رسائل نصية وصوتية بين صاحب الطلب والسائق." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    load: typeof search["load"] === "string" ? search["load"] : "",
  }),
  component: ChatPage,
});

function timeText(ts: number) {
  return new Intl.DateTimeFormat("ar-MA", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

function ChatPage() {
  const { load: loadId } = Route.useSearch();
  const { account, loads, bids, ready } = useHamoula();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const myPhone = phoneKey(account?.phone ?? "");
  const load = useMemo(() => loads.find((l) => l.id === loadId) ?? null, [loads, loadId]);
  const acceptedBid = useMemo(
    () => bids.find((b) => b.loadId === loadId && b.status === "accepted") ?? null,
    [bids, loadId],
  );

  const shipperPhone = phoneKey(load?.shipperPhone ?? "");
  const driverPhone = phoneKey(acceptedBid?.driverPhone ?? "");
  const driverKey = `d-${myPhone}`;

  // Only the shipper who owns the request and the driver who won it may open it.
  const isShipper = Boolean(myPhone) && account?.role === "shipper" && shipperPhone === myPhone;
  const isDriver =
    Boolean(myPhone) && account?.role === "driver" && acceptedBid?.driverId === driverKey;
  const allowed = Boolean(load) && (isShipper || isDriver);

  const counterpart = isShipper ? (acceptedBid?.driver ?? "السائق") : (load?.shipper ?? "صاحب البضاعة");

  useEffect(() => {
    if (!allowed || !loadId) return;
    let alive = true;
    void fetchMessages(loadId)
      .then((m) => {
        if (!alive) return;
        setMessages(m);
        markRead(loadId);
      })
      .catch(() => toast.error("ما قدرناش نجيبو الرسائل"));
    const off = subscribeMessages(loadId, (m) => {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      markRead(loadId);
    });
    return () => {
      alive = false;
      off();
    };
  }, [allowed, loadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const push = useCallback(
    async (body: string, voice: { path: string; duration: number; transcript?: string } | null) => {
      if (!loadId || !account) return;
      setSending(true);
      try {
        await sendMessage({
          loadId,
          shipperPhone,
          driverPhone,
          senderPhone: myPhone,
          senderRole: account.role,
          senderName: account.name,
          body,
          voice,
        });
        markRead(loadId);
      } catch {
        toast.error("ما تبعتاتش الرسالة — عاود المحاولة");
      } finally {
        setSending(false);
      }
    },
    [account, driverPhone, loadId, myPhone, shipperPhone],
  );

  const submit = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setText("");
    await push(body, null);
  };

  if (!ready) {
    return (
      <PhoneFrame>
        <AppHeader title="المحادثة" showBack />
        <main className="flex-1 p-5" />
      </PhoneFrame>
    );
  }

  if (!allowed) {
    return (
      <PhoneFrame>
        <AppHeader title="المحادثة" showBack />
        <main className="flex-1 p-5">
          <p className="rounded-2xl border-2 border-destructive/40 bg-destructive/10 p-4 text-center text-sm font-extrabold text-destructive">
            هاد المحادثة ماشي ديالك — كتقدر تفتح غير المحادثات ديال الطلبات ديالك.
          </p>
        </main>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <AppHeader title={`محادثة · ${counterpart}`} subtitle={`${load?.pickup} ← ${load?.destination}`} showBack />
      <main className="flex-1 space-y-3 p-5">
        {messages.length === 0 && (
          <p className="rounded-2xl border-2 border-border bg-card p-4 text-center text-sm font-bold text-muted-foreground">
            ما كاين حتى رسالة — بدا المحادثة دابا.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.senderPhone === myPhone;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                  mine ? "bg-primary text-primary-foreground" : "border-2 border-border bg-card"
                }`}
              >
                {!mine && (
                  <p className="mb-1 text-[11px] font-extrabold text-muted-foreground">
                    {m.senderName || counterpart}
                  </p>
                )}
                {m.voice ? (
                  <ChatVoiceBubble voice={m.voice} />
                ) : (
                  <p className="whitespace-pre-wrap text-sm font-bold leading-relaxed">{m.body}</p>
                )}
                <p className={`mt-1 text-[11px] font-bold ${mine ? "opacity-80" : "text-muted-foreground"}`}>
                  {timeText(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />

        <StickyActions>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRecording(true)}
              aria-label="رسالة صوتية"
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary active:scale-95"
            >
              <Mic className="size-6" />
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
              placeholder="كتب رسالة…"
              className="min-h-12 flex-1 rounded-2xl border-2 border-border bg-card px-3 text-base font-bold outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={sending || !text.trim()}
              aria-label="إرسال"
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground disabled:opacity-40 active:scale-95"
            >
              <Send className="size-6" />
            </button>
          </div>
        </StickyActions>
      </main>

      <VoiceRecorderSheet
        open={recording}
        onClose={() => setRecording(false)}
        title="رسالة صوتية"
        hint="قول رسالتك ونحبسو وحدنا منين تسالي"
        transcript="رسالة صوتية"
        onSend={(note) => {
          setRecording(false);
          void (async () => {
            if (!note.audioUrl || !loadId) {
              toast.error("ما كاين حتى تسجيل");
              return;
            }
            try {
              const blob = await (await fetch(note.audioUrl)).blob();
              const path = await uploadVoice(loadId, blob);
              await push("", {
                path,
                duration: note.duration,
                ...(note.transcript ? { transcript: note.transcript } : {}),
              });
            } catch {
              toast.error("ما تبعتاتش الرسالة الصوتية");
            }
          })();
        }}
      />
    </PhoneFrame>
  );
}
