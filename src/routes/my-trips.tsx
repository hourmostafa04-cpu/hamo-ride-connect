import { createFileRoute } from "@tanstack/react-router";
import { MyTrips } from "@/components/hamoula/MyTrips";

export const Route = createFileRoute("/my-trips")({
  head: () => ({
    meta: [
      { title: "رحلاتي | مول طرانسبور" },
      {
        name: "description",
        content: "الرحلات اللي قبلو فيك أصحاب البضائع: رحلة نشيطة وسجل الرحلات المكتملة.",
      },
      { property: "og:title", content: "رحلاتي | مول طرانسبور" },
      {
        property: "og:description",
        content: "سجل النقل ديالك كسائق فمول طرانسبور، محفوظ حتى بعد إغلاق التطبيق.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyTrips,
});
