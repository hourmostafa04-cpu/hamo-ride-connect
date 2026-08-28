import { createFileRoute } from "@tanstack/react-router";
import { DriverDashboard } from "@/components/hamoula/DriverDashboard";

export const Route = createFileRoute("/driver")({
  head: () => ({
    meta: [
      { title: "لوحة صاحب الشاحنة | مول طرانسبور" },
      {
        name: "description",
        content: "شوف طلبات نقل البضائع القريبة منك، اقبل الثمن المقترح ولا بعت عرض مضاد بالصوت.",
      },
      { property: "og:title", content: "لوحة صاحب الشاحنة | مول طرانسبور" },
      {
        property: "og:description",
        content: "طلبات جديدة من أصحاب البضائع مباشرة فالهاتف ديالك.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DriverDashboard,
});
