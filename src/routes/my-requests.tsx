import { createFileRoute } from "@tanstack/react-router";
import { MyRequests } from "@/components/hamoula/MyRequests";

export const Route = createFileRoute("/my-requests")({
  head: () => ({
    meta: [
      { title: "طلباتي | حمولة" },
      {
        name: "description",
        content: "كل طلبات النقل ديالك: مسودة، منشور، تم قبول سائق، في الطريق، تم التسليم ولا ملغى.",
      },
      { property: "og:title", content: "طلباتي | حمولة" },
      {
        property: "og:description",
        content: "تتبع وسجل كامل لطلبات نقل البضائع ديالك فحمولة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyRequests,
});
