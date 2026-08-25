import { createFileRoute } from "@tanstack/react-router";
import { OrderForm } from "@/components/hamoula/OrderForm";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "حمولة | طلب شاحنة لنقل بضاعتك" },
      {
        name: "description",
        content: "أنشئ طلب نقل بضاعة: نقطة التحميل، الوجهة، الخريطة والثمن بالدرهم — وتوصل بعروض السائقين.",
      },
      { property: "og:title", content: "حمولة | طلب شاحنة لنقل بضاعتك" },
      {
        property: "og:description",
        content: "منصة حمولة لنقل البضائع في المغرب: أنشئ طلبك في دقيقة وقارن العروض.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return <OrderForm isHome />;
}
