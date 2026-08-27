import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { phoneKey, useHamoula } from "@/lib/hamoula-store";
import { subscribeMessages, unreadCount } from "@/lib/hamoula-chat";

/** "محادثة" button + new-messages counter for one request. */
export function ChatButton({ loadId, className = "" }: { loadId: string; className?: string }) {
  const { account } = useHamoula();
  const myPhone = phoneKey(account?.phone ?? "");
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!loadId || !myPhone) return;
    let alive = true;
    const refresh = () => {
      void unreadCount(loadId, myPhone).then((n) => {
        if (alive) setUnread(n);
      });
    };
    refresh();
    const off = subscribeMessages(loadId, refresh);
    const timer = window.setInterval(refresh, 20000);
    return () => {
      alive = false;
      off();
      window.clearInterval(timer);
    };
  }, [loadId, myPhone]);

  return (
    <Link
      to="/chat"
      search={{ load: loadId }}
      className={`relative flex min-h-11 items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-extrabold text-primary ${className}`}
    >
      <MessageCircle className="size-5" />
      محادثة
      {unread > 0 && (
        <span className="absolute -top-2 -left-2 flex size-6 items-center justify-center rounded-full bg-destructive text-[11px] font-extrabold text-destructive-foreground">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
