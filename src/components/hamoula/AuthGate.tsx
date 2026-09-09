import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { RegisterScreen } from "@/components/hamoula/RegisterScreen";
import { useHamoula } from "@/lib/hamoula-store";

/** Routes only a driver account may open. */
const driverOnly = ["/driver", "/loads", "/my-bids", "/my-trips"];
/** Routes only a shipper account may open (the cargo request flow). */
const shipperOnly = ["/", "/request", "/offers", "/my-requests"];


export const driverHome = "/driver";
export const shipperHome = "/";

/** Registration is the first mandatory screen: nothing renders until an account exists. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { account, ready } = useHamoula();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const role = account?.role ?? null;
  // Role separation: the stored account role decides which dashboard is reachable.
  const blocked =
    role === "driver"
      ? shipperOnly.includes(pathname)
      : role === "shipper"
        ? driverOnly.includes(pathname)
        : false;

  useEffect(() => {
    if (!ready || !role || !blocked) return;
    navigate({ to: role === "driver" ? driverHome : shipperHome, replace: true });
  }, [ready, role, blocked, navigate]);

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
