import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/loads")({
  beforeLoad: () => {
    throw redirect({ to: "/driver" });
  },
});
