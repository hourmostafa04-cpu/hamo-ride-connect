import { QueryClient } from "@tanstack/react-query";
import { createRoute, createRouter, lazyRouteComponent } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// The /otp-test debug route exists ONLY in development. In production builds
// it is never registered on the router and its module (which calls
// supabase.auth.signInWithOtp/verifyOtp) is never imported — it stays out of
// the production bundle entirely, and opening /otp-test directly falls
// through to the 404 page without running any OTP code.
const tree = import.meta.env.DEV
  ? routeTree.addChildren([
      // Keep every generated route ("/", "/request", "/driver", ...) intact:
      // addChildren REPLACES the children list, so we must re-include them.
      ...(Object.values(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (routeTree as any).children ?? {},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ) as any[]),
      createRoute({
        getParentRoute: () => routeTree,
        path: "/otp-test",
        head: async () =>
          (await import("./dev/OtpTestPage")).otpTestHead(),
        component: lazyRouteComponent(
          () => import("./dev/OtpTestPage"),
          "OtpTestPage",
        ),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
    ])
  : routeTree;

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree: tree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
