import { useEffect, useRef, useState } from "react";
import { MapPin, Mic, Loader2, Crosshair } from "lucide-react";
import { toast } from "sonner";
import { HUB_CHIPS, searchPlaces } from "@/lib/hamoula-cities";
import { nearestCityName } from "@/lib/hamoula-location";
import { useAiDictation } from "@/hooks/use-ai-dictation";
import {
  searchMoroccoPlaces,
  resolveMoroccoPlace,
  reverseGeocodePoint,
} from "@/lib/places.functions";
import type { LatLng } from "@/lib/hamoula-geo";

type Suggestion = { key: string; main: string; secondary: string; placeId?: string; point?: LatLng };

/** Location field with full-Morocco places autocomplete (Google Places, server-side key). */
export default function CityField({
  label,
  icon,
  value,
  placeholder,
  onChange,
  onPick,
  showGps = false,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onPick: (label: string, point: LatLng) => void;
  showGps?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [results, setResults] = useState<Suggestion[]>([]);
  const seq = useRef(0);

  // Debounced Morocco-wide autocomplete; local city list is only an instant fallback.
  useEffect(() => {
    if (!open) return;
    const q = value.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const local: Suggestion[] = searchPlaces(q, 5).map((c) => ({
      key: `local:${c.label}`,
      main: c.label,
      secondary: "المغرب",
      point: c.point,
    }));
    setResults(local);
    setLoading(true);
    const id = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const remote = await searchMoroccoPlaces({ data: { query: q } });
        if (id !== seq.current) return;
        const mapped: Suggestion[] = remote.map((r) => ({
          key: `g:${r.placeId}`,
          main: r.main,
          secondary: r.secondary,
          placeId: r.placeId,
        }));
        setResults(mapped.length ? mapped : local);
      } catch {
        /* keep local fallback */
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [value, open]);

  const choose = async (s: Suggestion) => {
    if (s.point) {
      onPick(s.main, s.point);
      setOpen(false);
      return;
    }
    if (!s.placeId) return;
    setResolving(true);
    try {
      const place = await resolveMoroccoPlace({ data: { placeId: s.placeId } });
      onPick(place.label || s.main, place.point);
      setOpen(false);
    } catch {
      toast.error("ما قدرناش نجيبو هاد المكان — عاود جرب");
    } finally {
      setResolving(false);
    }
  };

  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("هاد الهاتف ما كيدعمش تحديد الموقع");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        let name = "";
        try {
          name = (await reverseGeocodePoint({ data: point })).label;
        } catch {
          name = "";
        }
        setLocating(false);
        const finalName = name || nearestCityName(point);
        onPick(finalName, point);
        toast.success(`موقعك الحالي: ${finalName}`);
      },
      () => {
        setLocating(false);
        toast.error("ما قدرناش نجيبو موقعك — فعّل الإذن ديال الموقع");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // Place-name mic: the spoken text feeds the same autocomplete — no auto-guessing.
  const dictation = useAiDictation({
    mode: "city",
    silenceMs: 2000,
    onText: (text) => {
      const spoken = text.replace(/[.،,!؟?]/g, " ").trim();
      if (!spoken) return;
      onChange(spoken);
      setOpen(true);
      toast.info("ختار المكان من اللائحة", { description: spoken });
    },
    onError: (m) => toast.error(m),
  });

  const busy = dictation.state !== "idle";

  return (
    <div>
      <label className="mb-2 block text-sm font-bold">{label}</label>
      <div className="relative">
        <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 py-3 focus-within:border-primary">
          {icon}
          <input
            value={value}
            placeholder={placeholder}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            className="w-full bg-transparent text-base font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground"
          />
          {(loading || resolving) && (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
          )}
          <button
            type="button"
            aria-label={`تسجيل صوتي لـ ${label}`}
            onClick={() => (dictation.state === "listening" ? dictation.stop() : dictation.start())}
            className={`grid size-10 shrink-0 place-items-center rounded-xl border-2 transition ${
              dictation.state === "listening"
                ? "animate-pulse border-primary bg-primary text-primary-foreground"
                : "border-border bg-secondary text-foreground"
            }`}
          >
            {dictation.state === "processing" ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Mic className="size-5" />
            )}
          </button>
        </div>
        {busy && (
          <p className="mt-1 text-xs font-bold text-primary">
            {dictation.state === "listening" ? "كنسمعك... قول سمية المكان" : "كنعالجو..."}
          </p>
        )}

        {showGps && (
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-primary bg-primary-soft px-4 py-3 text-sm font-bold text-accent-foreground disabled:opacity-70"
          >
            {locating ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Crosshair className="size-5" />
            )}
            {locating ? "كنحددو موقعك..." : "استخدم موقعي الحالي"}
          </button>
        )}

        {open && results.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-20 mt-2 max-h-72 overflow-auto rounded-2xl border-2 border-border bg-card shadow-soft">
            {results.map((c) => (
              <li key={c.key}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void choose(c)}
                  className="flex w-full items-start gap-2 px-4 py-3 text-right text-sm font-bold hover:bg-secondary"
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block truncate">{c.main}</span>
                    {c.secondary && (
                      <span className="block truncate text-xs font-semibold text-muted-foreground">
                        {c.secondary}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {HUB_CHIPS.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => onPick(c.label, c.point)}
            className={`rounded-full border-2 px-3 py-1 text-xs font-bold ${
              value === c.label
                ? "border-primary bg-primary-soft text-accent-foreground"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
