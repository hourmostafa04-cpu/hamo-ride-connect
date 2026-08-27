/**
 * Voice dictation powered by AI transcription (Whisper-class model on the
 * Lovable AI gateway) instead of the browser's SpeechRecognition — it handles
 * Moroccan Darija, mixed French/Arabic and heavy accents far better.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { startRecording, micErrorMessage, type RecorderHandle } from "@/lib/audio-recorder";
import { transcribeVoiceNote } from "@/lib/transcribe.functions";
import { fixDarijaWords } from "@/lib/darija-fix";
import { digitizeSpokenNumbers } from "@/lib/darija-digits";

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read_failed"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/** Send a recorded clip to the AI transcription endpoint. Never throws. */
export async function transcribeBlob(
  blob: Blob,
  mode: "general" | "phone" | "city" | "cargo" = "general"
): Promise<{ text: string; raw: string; error?: string }> {
  try {
    const audioBase64 = await blobToBase64(blob);
    const res = await transcribeVoiceNote({
      data: { audioBase64, mimeType: blob.type || "audio/wav", mode },
    });
    const raw = (res?.text ?? "").trim();
    if (!raw) return { text: "", raw: "", error: "ما فهمناش التسجيل — عاود سجل بصوت واضح" };
    // Phone mode stays untouched: no word fixes, no number merging — the strict
    // digit-by-digit parser runs on the exact transcript.
    if (mode === "phone") return { text: raw, raw };
    if (mode === "city" || mode === "cargo") return { text: fixDarijaWords(raw), raw };
    // Light clean-up only: known mishearings + spoken numbers -> digits.
    const fixed = fixDarijaWords(raw);
    return { text: digitizeSpokenNumbers(fixed), raw };
  } catch {
    return { text: "", raw: "", error: "ما قدرناش نعالجو التسجيل — عاود المحاولة" };
  }
}


export type DictationState = "idle" | "listening" | "processing";

export function useAiDictation(opts: {
  /** Fires with the Darija transcript once the clip is transcribed. */
  onText: (text: string, raw: string) => void | Promise<void>;
  onError?: (message: string) => void;
  /** Silence after speech that ends the take (default 2.5s). */
  silenceMs?: number;
  /** Field mode; "phone" uses a digits-only prompt and skips all text clean-up. */
  mode?:
    | "general"
    | "phone"
    | "city"
    | "cargo"
    | (() => "general" | "phone" | "city" | "cargo");
}) {
  const { onText, onError, silenceMs = 2000, mode = "general" } = opts;

  const [state, setState] = useState<DictationState>("idle");
  const [level, setLevel] = useState(0);
  const [settling, setSettling] = useState(false);
  const handleRef = useRef<RecorderHandle | null>(null);
  const busyRef = useRef(false);
  const cbRef = useRef({ onText, onError, mode });
  cbRef.current = { onText, onError, mode };


  const finish = useCallback(async () => {
    const handle = handleRef.current;
    if (!handle || busyRef.current) return;
    busyRef.current = true;
    handleRef.current = null;
    setSettling(false);
    setLevel(0);
    const blob = await handle.stop();
    if (!blob) {
      setState("idle");
      busyRef.current = false;
      cbRef.current.onError?.("ما سمعنا والو — عاود سجل قريب من الميكرو");
      return;
    }
    setState("processing");
    const { text, raw, error } = await transcribeBlob(blob, typeof cbRef.current.mode === "function" ? cbRef.current.mode() : cbRef.current.mode);
    setState("idle");
    busyRef.current = false;
    if (text) await cbRef.current.onText(text, raw || text);
    else if (error) cbRef.current.onError?.(error);
  }, []);

  const start = useCallback(async () => {
    if (handleRef.current || busyRef.current) return;
    setSettling(false);
    try {
      handleRef.current = await startRecording({
        silenceMs,
        onLevel: setLevel,
        onSpeech: () => setSettling(false),
        onSilence: () => {
          setSettling(true);
          void finish();
        },
      });
      setState("listening");
    } catch (e) {
      setState("idle");
      cbRef.current.onError?.(micErrorMessage(e));
    }
  }, [finish, silenceMs]);

  const stop = useCallback(() => void finish(), [finish]);

  const cancel = useCallback(() => {
    handleRef.current?.cancel();
    handleRef.current = null;
    setState("idle");
    setLevel(0);
    setSettling(false);
  }, []);

  useEffect(() => () => handleRef.current?.cancel(), []);

  return { state, level, settling, start, stop, cancel } as const;
}
