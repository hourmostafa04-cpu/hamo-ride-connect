import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { hasRatedTrip, submitRating } from "@/lib/hamoula-ratings";

type Props = {
  loadId: string;
  raterPhone: string;
  raterRole: "shipper" | "driver";
  rateePhone: string;
  rateeRole: "shipper" | "driver";
  counterpartName: string;
};

/** تقييم متبادل بعد انتهاء الرحلة — نجوم من 1 حتى 5 وتعليق اختياري. */
export function TripRating({
  loadId,
  raterPhone,
  raterRole,
  rateePhone,
  rateeRole,
  counterpartName,
}: Props) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    setChecked(false);
    hasRatedTrip(loadId)
      .then((r) => {
        if (!alive) return;
        setDone(r);
        setChecked(true);
      })
      .catch(() => alive && setChecked(true));
    return () => {
      alive = false;
    };
  }, [loadId]);

  if (!loadId || !rateePhone) return null;

  const save = async () => {
    if (!stars || busy) return;
    setBusy(true);
    try {
      await submitRating({
        loadId,
        raterPhone,
        raterRole,
        rateePhone,
        rateeRole,
        stars,
        comment,
      });
      setDone(true);
      toast.success("شكراً، تسجل التقييم ديالك");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ما تسناش التقييم");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-3xl border-2 border-primary/30 bg-primary-soft/40 p-4">
      <h2 className="font-extrabold">
        {rateeRole === "driver" ? "قيّم صاحب الشاحنة" : "قيّم صاحب البضاعة"}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{counterpartName}</p>

      {done ? (
        <p className="mt-3 rounded-2xl bg-card px-3 py-3 text-sm font-bold text-primary">
          قيّمتي هاد الرحلة من قبل — شكراً ليك
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-row-reverse items-center justify-end gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} نجوم`}
                onClick={() => setStars(n)}
                className="rounded-full p-1"
              >
                <Star
                  className={`size-8 ${n <= stars ? "fill-primary text-primary" : "text-muted-foreground"}`}
                />
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="تعليق قصير (اختياري)"
            className="mt-3 w-full rounded-2xl border-2 border-border bg-card p-3 text-sm outline-none focus:border-primary"
          />
          <button
            type="button"
            disabled={!stars || busy || !checked}
            onClick={save}
            className="mt-3 w-full rounded-2xl bg-primary px-4 py-3 font-extrabold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "كنسجلو التقييم…" : "أرسل التقييم"}
          </button>
        </>
      )}
    </section>
  );
}
