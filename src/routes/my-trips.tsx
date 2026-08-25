import { createFileRoute } from "@tanstack/react-router";
import { MyTrips } from "@/components/hamoula/MyTrips";

export const Route = createFileRoute("/my-trips")({
  head: () => ({
    meta: [
      { title: "رحلاتي | حمولة" },
      {
        name: "description",
        content: "الرحلات اللي قبلو فيك أصحاب البضائع: رحلة نشيطة وسجل الرحلات المكتملة.",
      },
      { property: "og:title", content: "رحلاتي | حمولة" },
      {
        property: "og:description",
        content: "سجل النقل ديالك كسائق فحمولة، محفوظ حتى بعد إغلاق التطبيق.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyTrips,
});
