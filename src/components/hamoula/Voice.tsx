import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Play, Pause, Trash2, Volume2, Square, Check, X } from "lucide-react";
import { playSfx } from "@/lib/sfx";
import { startRecording, micErrorMessage, type RecorderHandle } from "@/lib/audio-recorder";
import { transcribeBlob } from "@/hooks/use-ai-dictation";
import { useAppLanguage } from "@/lib/app-language";

let arabicVoice: SpeechSynthesisVoice | null = null;

function pickArabicVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  if (arabicVoice) return arabicVoice;
  const voices = window.speechSynthesis.getVoices();
  arabicVoice =
    voices.find((v) => v.lang?.toLowerCase().startsWith("ar-ma")) ??
    voices.find((v) => v.lang?.toLowerCase().startsWith("ar")) ??
    null;
  return arabicVoice;
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    arabicVoice = null;
    pickArabicVoice();
  };
}

/** Speaks Arabic text using the browser speech engine. Returns false when unsupported. */
export function speak(text: string, onEnd?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onEnd?.();
    return false;
  }
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickArabicVoice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? "ar-MA";
    u.rate = 0.92;
    u.pitch = 1;
    u.volume = 1;
    // Fire onEnd exactly once — some browsers never deliver `onend` (no voice
    // installed, backgrounded tab), which would leave the mic never starting.
    let done = false;
    const finishOnce = () => {
      if (done) return;
      done = true;
      onEnd?.();
    };
    u.onend = finishOnce;
    u.onerror = finishOnce;
    window.setTimeout(finishOnce, Math.min(6000, 1200 + text.length * 90));
    // Chrome sometimes needs a resume nudge.
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    onEnd?.();
    return false;
  }
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  return `${m}:${s}`;
}

const BAR_HEIGHTS = [
  40, 70, 30, 90, 55, 100, 45, 75, 35, 85, 60, 95, 30, 65, 50, 80, 40, 70, 90, 45, 60, 35, 75, 55,
  85, 40, 95, 50, 70, 30,
];

/** Animated waveform. `progress` (0-1) colors the played part. `levels` renders live mic input. */
export function Waveform({
  active = false,
  progress = 1,
  levels,
  className = "",
}: {
  active?: boolean;
  progress?: number;
  levels?: number[];
  className?: string;
}) {
  const bars = levels?.length ? levels : BAR_HEIGHTS;
  return (
    <div className={`flex h-10 flex-1 items-center gap-[3px] ${className}`} aria-hidden>
      {bars.map((h, i) => {
        const played = i / bars.length <= progress;
        return (
          <span
            key={i}
            className={`w-[3px] rounded-full transition-all duration-100 ${
              played ? "bg-primary" : "bg-muted-foreground/30"
            } ${active && !levels ? "animate-pulse" : ""}`}
            style={{
              height: `${Math.max(12, Math.min(100, h))}%`,
              animationDelay: `${(i % 8) * 70}ms`,
            }}
          />
        );
      })}
    </div>
  );
}

export const WELCOME_MESSAGE =
  "مرحبا بك في تطبيق حمولة، حدد مكان التحميل والوجهة أو سجل طلبك بالصوت";

/** Voice banner with a big speaker icon and a play button for audio guidance. */
export function VoiceBanner({ message }: { message?: string }) {
  const fr = useAppLanguage() === "fr";
  const t = (ar: string, frText: string) => (fr ? frText : ar);
  const resolvedMessage = message ?? t(WELCOME_MESSAGE, "Bienvenue sur Hamoula, définissez le point de chargement et la destination, ou enregistrez votre demande par la voix");
  const [playing, setPlaying] = useState(false);

  useEffect(() => () => stopSpeaking(), []);

  const toggle = () => {
    if (playing) {
      stopSpeaking();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    const ok = speak(resolvedMessage, () => setPlaying(false));
    if (!ok) setPlaying(false);
  };

  return (
    <section className="rounded-3xl border-2 border-primary bg-primary-soft p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Volume2 className="size-7" />
        </span>
        <p className="flex-1 text-base font-extrabold leading-snug text-accent-foreground">
          {resolvedMessage}
        </p>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={toggle}
          aria-label={playing ? t("إيقاف الإرشاد الصوتي", "Arrêter le guide vocal") : t("تشغيل الإرشاد الصوتي", "Lancer le guide vocal")}
          className="flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-5 text-base font-extrabold text-primary-foreground active:opacity-90"
        >
          {playing ? <Pause className="size-6" /> : <Play className="size-6" />}
          {playing ? t("توقيف", "Arrêter") : t("سمع الشرح", "Écouter l'explication")}
        </button>
        <Waveform active={playing} progress={playing ? 1 : 0} />
      </div>
    </section>
  );
}

/** Player for a voice note: plays the real recording when present, else reads the transcript. */
export function VoiceNotePlayer({
  duration,
  transcript,
  audioUrl,
  title,
  tone = "light",
}: {
  duration: number;
  transcript?: string;
  audioUrl?: string | null | undefined;
  title?: string;
  tone?: "light" | "primary";
}) {
  const fr = useAppLanguage() === "fr";
  const t = (ar: string, frText: string) => (fr ? frText : ar);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!playing || audioUrl) return;
    const t = setInterval(() => {
      setElapsed((e) => {
        if (e + 0.25 >= duration) {
          clearInterval(t);
          setPlaying(false);
          return 0;
        }
        return e + 0.25;
      });
    }, 250);
    return () => clearInterval(t);
  }, [playing, duration, audioUrl]);

  useEffect(() => {
    return () => {
      // Read on unmount on purpose: the <audio> element is only attached after mount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      audioRef.current?.pause();
      stopSpeaking();
    };
  }, []);

  const toggle = () => {
    if (playing) {
      audioRef.current?.pause();
      stopSpeaking();
      setPlaying(false);
      setElapsed(0);
      return;
    }
    if (audioUrl) {
      const el = audioRef.current;
      if (!el) return;
      el.currentTime = 0;
      void el.play().catch(() => setPlaying(false));
      setPlaying(true);
      return;
    }
    setPlaying(true);
    if (transcript) speak(transcript, () => setPlaying(false));
  };

  const total = audioUrl ? audioRef.current?.duration || duration : duration;

  return (
    <div
      className={`rounded-2xl border-2 p-3 ${
        tone === "primary" ? "border-primary bg-primary-soft" : "border-border bg-card"
      }`}
    >
      {title && <p className="mb-2 text-xs font-bold text-muted-foreground">{title}</p>}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          onTimeUpdate={(e) => setElapsed(e.currentTarget.currentTime)}
          onEnded={() => {
            setPlaying(false);
            setElapsed(0);
          }}
          className="hidden"
        />
      )}
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          aria-label={playing ? t("إيقاف التسجيل الصوتي", "Arrêter l'audio") : t("تشغيل التسجيل الصوتي", "Lire l'audio")}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground active:opacity-90"
        >
          {playing ? <Pause className="size-6" /> : <Play className="size-6" />}
        </button>
        <Waveform active={playing} progress={playing ? elapsed / Math.max(total, 0.1) : 1} />
        <span className="w-12 text-left text-sm font-extrabold text-muted-foreground">
          {formatDuration(playing ? Math.max(total - elapsed, 0) : duration)}
        </span>
      </div>
      {transcript && (
        <p className="mt-2 text-sm font-semibold leading-relaxed text-foreground">«{transcript}»</p>
      )}
    </div>
  );
}

/** Big floating microphone button. */
export function MicFab({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <div className="pointer-events-none sticky bottom-0 z-30 -mx-5 mt-6 bg-gradient-to-t from-background via-background to-transparent px-5 pb-6 pt-8">
      <button
        onClick={onClick}
        className="pointer-events-auto mx-auto flex w-full max-w-sm items-center justify-center gap-3 rounded-3xl bg-primary py-5 text-xl font-extrabold text-primary-foreground shadow-soft active:opacity-90"
      >
        <span className="relative flex size-14 items-center justify-center rounded-full bg-primary-foreground/20">
          <span className="absolute inline-flex size-14 animate-ping rounded-full bg-primary-foreground/30" />
          <Mic className="relative size-8" />
        </span>
        {label}
      </button>
    </div>
  );
}

export type RecordedNote = { duration: number; transcript: string; audioUrl?: string };

const BAR_COUNT = 30;

/** Real microphone recorder: MediaRecorder + live waveform + timer, then play/send preview. */
export function VoiceRecorderSheet({
  open,
  onClose,
  onSend,
  onTranscript,
  title,
  hint,
  transcript,
}: {
  open: boolean;
  onClose: () => void;
  onSend: (note: RecordedNote) => void;
  onTranscript?: (text: string) => void;
  title: string;
  hint: string;
  transcript: string;
}) {
  const fr = useAppLanguage() === "fr";
  const t = (ar: string, frText: string) => (fr ? frText : ar);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(14));
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [heard, setHeard] = useState("");
  const [processing, setProcessing] = useState(false);
  const [silenceSoon, setSilenceSoon] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const handleRef = useRef<RecorderHandle | null>(null);
  const urlRef = useRef<string | null>(null);
  const finishingRef = useRef(false);
  const transcriptCbRef = useRef(onTranscript);
  transcriptCbRef.current = onTranscript;

  const pushLevel = useCallback((v: number) => {
    setLevels((prev) => {
      const next = prev.slice(1);
      next.push(Math.max(12, Math.min(100, v * 260)));
      return next;
    });
  }, []);

  /** Stop the take, encode the WAV, and let the Darija-aware AI transcribe it. */
  const finish = useCallback(async () => {
    const handle = handleRef.current;
    if (!handle || finishingRef.current) return;
    finishingRef.current = true;
    handleRef.current = null;
    playSfx("stop");
    setSilenceSoon(false);
    setRecording(false);
    setLevels(Array(BAR_COUNT).fill(14));

    const blob = await handle.stop();
    if (!blob) {
      finishingRef.current = false;
      setError(t("ما سمعنا والو — عاود سجل قريب من الميكرو", "Aucun son capté — rapprochez-vous du micro et réessayez"));
      return;
    }
    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    setAudioUrl(url);

    setProcessing(true);
    const { text, error: err } = await transcribeBlob(blob);
    setProcessing(false);
    finishingRef.current = false;
    if (text) {
      setHeard(text);
      transcriptCbRef.current?.(text);
    } else if (err) {
      setError(err);
    }
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(20);
  }, []);

  const cleanup = useCallback(() => {
    handleRef.current?.cancel();
    handleRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (handleRef.current || finishingRef.current) return;
    setError(null);
    setSeconds(0);
    setHeard("");
    setSilenceSoon(false);
    setAudioUrl(null);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;

    try {
      handleRef.current = await startRecording({
        silenceMs: 2000,
        onLevel: pushLevel,
        onSpeech: () => setSilenceSoon(false),
        onSilence: () => {
          setSilenceSoon(true);
          void finish();
        },
      });
      playSfx("record");
      setRecording(true);
    } catch (e) {
      setRecording(false);
      setError(micErrorMessage(e));
    }
  }, [finish, pushLevel]);

  const stop = useCallback(() => void finish(), [finish]);

  useEffect(() => {
    if (open) void start();
    return () => cleanup();
  }, [open, start, cleanup]);

  useEffect(() => {
    if (!open || !recording) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [open, recording]);

  const discardTake = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setHeard("");
    setAudioUrl(null);
    setError(null);
    setSeconds(0);
  };

  const close = () => {
    cleanup();
    discardTake();
    setConfirmClose(false);
    onClose();
  };

  const requestClose = () => {
    if (recording || audioUrl || heard.trim()) setConfirmClose(true);
    else close();
  };

  const retry = () => {
    discardTake();
    void start();
  };

  const confirmSend = () => {
    const text = heard.trim();
    playSfx("send");
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(30);
    if (text) onTranscript?.(text);
    onSend({
      duration: Math.max(seconds, 1),
      transcript: text || (audioUrl ? t("رسالة صوتية مسجلة", "Message vocal enregistré") : transcript),
      ...(audioUrl ? { audioUrl } : {}),
    });
    urlRef.current = null;
  };

  if (!open) return null;

  const duration = Math.max(seconds, 1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div className="w-full max-w-md rounded-3xl bg-background p-5 shadow-soft">
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <h2 className="text-center text-xl font-extrabold">
              {recording ? title : t("مراجعة التسجيل", "Vérifier l'enregistrement")}
            </h2>
            <p className="mt-1 text-center text-sm font-semibold text-muted-foreground">
              {recording ? hint : t("سمع التسجيل وتأكد من الكلام قبل ما تبعث", "Écoutez l'enregistrement et vérifiez le texte avant l'envoi")}
            </p>
          </div>
          <button
            onClick={requestClose}
            aria-label={t("إغلاق", "Fermer")}
            className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-border text-muted-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        {error && (
          <p className="mt-3 rounded-2xl border-2 border-destructive/40 bg-destructive/10 p-3 text-center text-sm font-bold text-destructive">
            {error}
          </p>
        )}

        {confirmClose ? (
          <div className="mt-6 flex flex-col items-center gap-4">
            <p className="text-center text-lg font-extrabold">{t("هل تريد إلغاء التسجيل؟", "Voulez-vous annuler l'enregistrement ?")}</p>
            <p className="text-center text-sm font-semibold text-muted-foreground">
              {t("غادي يتمسح التسجيل والكلام اللي سجلتي", "L'enregistrement et le texte seront supprimés")}
            </p>
            <div className="mt-2 flex w-full gap-3">
              <button
                onClick={close}
                className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-destructive text-lg font-extrabold text-destructive-foreground"
              >
                <Trash2 className="size-6" />
                {t("نعم، ألغِ", "Oui, annuler")}
              </button>
              <button
                onClick={() => setConfirmClose(false)}
                className="flex min-h-14 flex-1 items-center justify-center rounded-2xl border-2 border-primary text-lg font-extrabold text-primary"
              >
                {t("رجوع", "Retour")}
              </button>
            </div>
          </div>
        ) : recording ? (
          <>
            <div className="mt-6 flex flex-col items-center gap-4">
              <span
                className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-extrabold transition-colors ${
                  silenceSoon
                    ? "bg-primary-soft text-primary"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                <span
                  className={`size-3 animate-pulse rounded-full ${silenceSoon ? "bg-primary" : "bg-destructive"}`}
                />
                {silenceSoon ? t("سالينا؟ غانحبسو التسجيل…", "Terminé ? Arrêt imminent de l'enregistrement…") : t("كنسجل دابا", "Enregistrement en cours") }
              </span>
              <span
                className={`relative flex size-24 items-center justify-center rounded-full transition-all duration-300 ${
                  silenceSoon
                    ? "bg-primary/60 text-primary-foreground ring-4 ring-primary/40"
                    : "bg-primary text-primary-foreground"
                }`}
              >
                <span
                  className={`absolute inline-flex size-24 rounded-full ${
                    silenceSoon ? "animate-pulse bg-primary/20" : "animate-ping bg-primary/40"
                  }`}
                />
                <Mic className="relative size-10" />
              </span>
              <span className="text-3xl font-extrabold tabular-nums text-primary">
                {formatDuration(seconds)}
              </span>
              <Waveform
                active
                levels={levels}
                progress={1}
                className={`w-full transition-opacity duration-300 ${silenceSoon ? "opacity-40" : ""}`}
              />
              <p className="w-full rounded-2xl bg-secondary p-3 text-center text-sm font-bold leading-relaxed">
                {heard || t("تكلم دابا… غانكتبو كلامك ونوريوهلك قبل الإرسال", "Parlez maintenant… votre texte sera transcrit avant l'envoi")}
              </p>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={stop}
                className="flex min-h-16 flex-1 items-center justify-center gap-2 rounded-2xl bg-destructive text-xl font-extrabold text-destructive-foreground"
              >
                <Square className="size-7" />
                {t("حبس التسجيل", "Arrêter l'enregistrement")}
              </button>

              <button
                onClick={requestClose}
                aria-label={t("إلغاء", "Annuler")}
                className="flex min-h-14 min-w-14 items-center justify-center rounded-2xl border-2 border-border text-muted-foreground"
              >
                <Trash2 className="size-6" />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-5">
              <VoiceNotePlayer
                duration={duration}
                {...(heard ? { transcript: heard } : audioUrl ? {} : { transcript })}
                audioUrl={audioUrl}
                tone="primary"
              />
            </div>
            {processing && (
              <p className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-primary-soft p-3 text-center text-sm font-extrabold text-primary">
                <span className="size-3 animate-ping rounded-full bg-primary" />
                {t("كنحللو التسجيل بالذكاء الاصطناعي…", "Analyse de l'enregistrement par IA…")}
              </p>
            )}
            {!processing && (
              <div className="mt-4">
                <label
                  htmlFor="voice-transcript"
                  className="mb-1 block text-sm font-extrabold text-muted-foreground"
                >
                  {t("الكلام اللي فهمنا — تقدر تصححو قبل الإرسال", "Texte reconnu — vous pouvez le corriger avant l'envoi")}
                </label>
                <textarea
                  id="voice-transcript"
                  dir={fr ? "ltr" : "rtl"}
                  rows={3}
                  value={heard}
                  onChange={(e) => setHeard(e.target.value)}
                  placeholder={t("عاود كتب الكلام هنا إلى بغيتي تصححو…", "Réécrivez le texte ici si vous souhaitez le corriger…")}
                  className="w-full rounded-2xl border-2 border-border bg-secondary p-3 text-base font-bold leading-relaxed text-foreground outline-none focus:border-primary"
                />
              </div>
            )}
            <div className="mt-5 space-y-3">
              <button
                onClick={confirmSend}
                disabled={processing}
                className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-extrabold text-primary-foreground disabled:opacity-60"
              >
                <Check className="size-6" />
                {t("إرسال وتأكيد الطلب", "Envoyer et confirmer la demande")}
              </button>
              <button
                onClick={retry}
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-destructive text-lg font-extrabold text-destructive"
              >
                <Trash2 className="size-6" />
                {t("مسح وإعادة التسجيل", "Supprimer et réenregistrer")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
