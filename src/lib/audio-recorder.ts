/**
 * Mic capture that always produces a complete, decodable 16 kHz mono WAV file.
 * We avoid MediaRecorder chunks (headerless fragments / Safari fragmented mp4)
 * because the AI transcription endpoint rejects them.
 */

export type RecorderHandle = {
  /** Stop capture and return the encoded WAV (null when nothing was captured). */
  stop: () => Promise<Blob | null>;
  /** Abort without producing a blob. */
  cancel: () => void;
  /** 0..1 instant loudness, for waveforms + silence detection. */
  level: () => number;
};

export type RecorderOptions = {
  /** Called ~10x/second with 0..1 loudness. */
  onLevel?: (level: number) => void;
  /** Called once the voice-activity detector sees silence after real speech. */
  onSilence?: () => void;
  /** Silence (ms) after speech before onSilence fires. */
  silenceMs?: number;
  /** Fires when speech is detected for the first time. */
  onSpeech?: () => void;
  /** Live 16 kHz mono 16-bit PCM frames, for realtime streaming (Deepgram). */
  onPcm?: (frame: Int16Array) => void;
};


const TARGET_RATE = 16000;

function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (to >= from) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j] ?? 0;
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

/** Standard 16-bit mono WAV file from Float32 PCM chunks. */
export function encodeWav(chunks: Float32Array[], sampleRate: number): Blob {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  const pcm = downsample(merged, sampleRate, TARGET_RATE);
  const rate = sampleRate > TARGET_RATE ? TARGET_RATE : sampleRate;

  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  const writeStr = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(pos + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i] ?? 0));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export class MicError extends Error {
  constructor(public reason: "unsupported" | "denied" | "missing" | "failed") {
    super(reason);
  }
}

/** Arabic message for a mic failure. */
export function micErrorMessage(e: unknown): string {
  const reason = e instanceof MicError ? e.reason : "failed";
  return reason === "unsupported"
    ? "المتصفح ديالك ما كيدعمش التسجيل الصوتي — جرب Chrome"
    : reason === "denied"
      ? "المصادقة على الميكروفون مرفوضة — سمح بالميكروفون من إعدادات المتصفح"
      : reason === "missing"
        ? "ما لقيناش شي ميكروفون فهاد الجهاز"
        : "ما قدرناش نوصلو للميكروفون — عاود المحاولة";
}

/** Start capturing mic audio; resolves once the stream is live. */
export async function startRecording(options: RecorderOptions = {}): Promise<RecorderHandle> {
  const { onLevel, onSilence, onSpeech, onPcm, silenceMs = 2000 } = options;
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new MicError("unsupported");
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (e) {
    const name = (e as { name?: string })?.name;
    throw new MicError(
      name === "NotAllowedError" || name === "SecurityError"
        ? "denied"
        : name === "NotFoundError"
          ? "missing"
          : "failed",
    );
  }

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) {
    stream.getTracks().forEach((t) => t.stop());
    throw new MicError("unsupported");
  }

  const ctx = new Ctor();
  // Wait for the context to actually run: on iOS/Safari a suspended context
  // silently swallows the first few hundred ms (the first spoken word).
  try {
    await ctx.resume?.();
  } catch {
    /* ignore — some browsers reject resume() outside a gesture */
  }

  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  let current = 0;
  let heardSpeech = false;
  let lastLoud = performance.now();
  let finished = false;

  // Pre-roll: everything captured from graph start is kept, so the ~300ms
  // before the first loud frame is always part of the WAV.
  const PRE_ROLL_MS = 300;
  const preRollFrames = Math.max(1, Math.ceil((PRE_ROLL_MS / 1000) * ctx.sampleRate) / 4096);
  const startedAt = performance.now();

  // Adaptive noise floor: measured over the first 300ms, so quiet speakers
  // still trigger speech detection instead of being treated as silence.
  let noiseFloor = 0;
  let calibFrames = 0;
  const MIN_THRESHOLD = 0.012;

  processor.onaudioprocess = (e) => {
    const data = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(data));
    if (onPcm) {
      const ds = downsample(data, ctx.sampleRate, TARGET_RATE);
      const pcm = new Int16Array(ds.length);
      for (let i = 0; i < ds.length; i++) {
        const s = Math.max(-1, Math.min(1, ds[i] ?? 0));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      onPcm(pcm);
    }
    let peak = 0;
    for (let i = 0; i < data.length; i += 8) peak = Math.max(peak, Math.abs(data[i] ?? 0));
    current = peak;
    onLevel?.(peak);

    const now = performance.now();

    // Calibrate on the pre-roll window before judging speech.
    if (now - startedAt < PRE_ROLL_MS || calibFrames < preRollFrames) {
      noiseFloor = Math.max(noiseFloor, peak);
      calibFrames++;
      lastLoud = now;
      return;
    }

    const threshold = Math.max(MIN_THRESHOLD, noiseFloor * 1.8);

    if (peak > threshold) {
      if (!heardSpeech) onSpeech?.();
      heardSpeech = true;
      lastLoud = now;
    } else if (heardSpeech && !finished && now - lastLoud > silenceMs) {
      finished = true;
      onSilence?.();
    }
  };


  source.connect(processor);
  // Keep the graph alive without echoing the mic back to the speakers.
  const mute = ctx.createGain();
  mute.gain.value = 0;
  processor.connect(mute);
  mute.connect(ctx.destination);

  const teardown = () => {
    processor.onaudioprocess = null;
    try {
      processor.disconnect();
      source.disconnect();
      mute.disconnect();
    } catch {
      /* ignore */
    }
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close().catch(() => {});
  };

  return {
    level: () => current,
    cancel: () => {
      finished = true;
      teardown();
    },
    stop: async () => {
      finished = true;
      const rate = ctx.sampleRate;
      teardown();
      if (!chunks.length) return null;
      const blob = encodeWav(chunks, rate);
      return blob.size > 2048 ? blob : null;
    },
  };
}
