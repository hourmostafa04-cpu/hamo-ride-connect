import { createFileRoute } from "@tanstack/react-router";
import { MyBids } from "@/components/hamoula/MyBids";

export const Route = createFileRoute("/my-bids")({
  head: () => ({
    meta: [
      { title: "سجل العروض ديالي | حمولة" },
      {
        name: "description",
        content: "شوف كاع العروض اللي بعتي: مقبولة، مرفوضة ولا قيد المراجعة، بالثمن والتاريخ.",
      },
      { property: "og:title", content: "سجل العروض ديالي | حمولة" },
      {
        property: "og:description",
        content: "تتبع حالة العروض ديالك مع أصحاب البضائع فمكان واحد.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyBids,
});
