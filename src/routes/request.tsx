import { createFileRoute } from "@tanstack/react-router";
import { OrderForm } from "@/components/hamoula/OrderForm";

export const Route = createFileRoute("/request")({
  head: () => ({
    meta: [
      { title: "طلب شاحنة | مول طرانسبور" },
      {
        name: "description",
        content: "حدد نقطة التحميل والوجهة ونوع الشاحنة والثمن بالدرهم، وتوصل بعروض السائقين.",
      },
      { property: "og:title", content: "طلب شاحنة | مول طرانسبور" },
      {
        property: "og:description",
        content: "أنشئ طلب نقل بضاعة في دقيقة واحدة عبر مول طرانسبور.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RequestPage,
});

function RequestPage() {
  return <OrderForm />;
}
