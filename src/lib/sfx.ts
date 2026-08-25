/** Lightweight WebAudio UI sound effects (no asset files needed). */

let ctx: AudioContext | null = null;
let muted = false;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  start: number,
  dur: number,
  gain = 0.06,
  type: OscillatorType = "sine",
) {
  const c = audio();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + start);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  osc.connect(g).connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + dur + 0.02);
}

export type SfxName = "tap" | "success" | "incoming" | "send" | "record" | "stop" | "error";

export function playSfx(name: SfxName) {
  if (muted || typeof window === "undefined") return;
  try {
    switch (name) {
      case "tap":
        tone(660, 0, 0.07, 0.035, "triangle");
        break;
      case "send":
        tone(600, 0, 0.08, 0.05);
        tone(900, 0.06, 0.1, 0.05);
        break;
      case "success":
        tone(660, 0, 0.1, 0.06);
        tone(880, 0.09, 0.12, 0.06);
        tone(1180, 0.19, 0.18, 0.05);
        break;
      case "incoming":
        tone(1046, 0, 0.09, 0.05, "triangle");
        tone(784, 0.1, 0.14, 0.045, "triangle");
        break;
      case "record":
        tone(520, 0, 0.12, 0.05, "sine");
        break;
      case "stop":
        tone(400, 0, 0.14, 0.05, "sine");
        break;
      case "error":
        tone(320, 0, 0.18, 0.05, "sawtooth");
        break;
    }
  } catch {
    /* ignore */
  }
}

export function setSfxMuted(value: boolean) {
  muted = value;
}

/** Global click feedback for buttons/links. Returns a cleanup function. */
export function attachGlobalTapSound() {
  if (typeof document === "undefined") return () => {};
  const handler = (e: Event) => {
    const el = (e.target as HTMLElement | null)?.closest("button, a, [role='button']");
    if (!el || (el as HTMLButtonElement).disabled) return;
    if (el.getAttribute("data-no-sfx") !== null) return;
    playSfx("tap");
  };
  document.addEventListener("pointerdown", handler, true);
  return () => document.removeEventListener("pointerdown", handler, true);
}
