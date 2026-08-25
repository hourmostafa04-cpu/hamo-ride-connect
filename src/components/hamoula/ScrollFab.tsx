import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";

/** Floating circular button: scrolls to bottom when at top, back to top when scrolled down. */
export function ScrollFab() {
  const [scrolled, setScrolled] = useState(false);
  const [scrollable, setScrollable] = useState(false);

  useEffect(() => {
    const update = () => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrollable(max > 80);
      setScrolled(y > 120);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const t = window.setInterval(update, 1000);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.clearInterval(t);
    };
  }, []);

  if (!scrollable) return null;

  const go = () => {
    window.scrollTo({
      top: scrolled ? 0 : document.documentElement.scrollHeight,
      behavior: "smooth",
    });
  };

  return (
    <button
      type="button"
      onClick={go}
      aria-label={scrolled ? "الرجوع للأعلى" : "النزول للأسفل"}
      className="fixed bottom-24 left-4 z-40 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft ring-2 ring-primary-foreground/20 transition active:scale-95"
    >
      {scrolled ? <ArrowUp className="size-6" /> : <ArrowDown className="size-6" />}
    </button>
  );
}
