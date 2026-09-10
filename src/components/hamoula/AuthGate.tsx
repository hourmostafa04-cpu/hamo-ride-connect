import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { toast } from "sonner";
import { RegisterScreen } from "@/components/hamoula/RegisterScreen";
import { useHamoula } from "@/lib/hamoula-store";

/** Routes only a driver account may open. */
const driverOnly = ["/driver", "/loads", "/my-bids", "/my-trips"];
/** Routes only a shipper account may open (the cargo request flow). */
const shipperOnly = ["/", "/request", "/offers", "/my-requests"];


export const driverHome = "/driver";
export const shipperHome = "/";

/** True when the path is (or is nested under) one of the protected routes. */
function matches(list: string[], pathname: string) {
  return list.some((p) => (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(`${p}/`)));
}

/** Registration is the first mandatory screen: nothing renders until an account exists. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { account, ready } = useHamoula();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const warned = useRef("");

  const role = account?.role ?? null;
  // Role separation: the stored account role decides which dashboard is reachable.
  const blocked =
    role === "driver"
      ? matches(shipperOnly, pathname)
      : role === "shipper"
        ? matches(driverOnly, pathname)
        : false;

  useEffect(() => {
    if (!ready || !role || !blocked) return;
    if (warned.current !== pathname) {
      warned.current = pathname;
      toast("هاد الصفحة ماشي ديال الحساب ديالك", { description: "رجعناك للوحة ديالك" });
    }
    navigate({ to: role === "driver" ? driverHome : shipperHome, replace: true });
  }, [ready, role, blocked, pathname, navigate]);

  if (!ready) return null;

  if (!account && pathname !== "/auth" && pathname !== "/otp-test") {
    return (
      <RegisterScreen
        onDone={(r) => navigate({ to: r === "driver" ? driverHome : shipperHome })}
      />
    );
  }

  if (blocked) return null;

  return <>{children}</>;
}
