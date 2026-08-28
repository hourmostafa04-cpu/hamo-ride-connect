import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RegisterScreen } from "@/components/hamoula/RegisterScreen";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "مول طرانسبور | التسجيل والدخول" },
      {
        name: "description",
        content: "دخل لمول طرانسبور برقم الهاتف ديالك بلا إيميل: كتب الاسم والرقم وابدأ النقل دغيا.",
      },
      { property: "og:title", content: "مول طرانسبور | التسجيل والدخول" },
      {
        property: "og:description",
        content: "دخل لمول طرانسبور برقم الهاتف ديالك بلا إيميل: كتب الاسم والرقم وابدأ النقل دغيا.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthScreen,
});

function AuthScreen() {
  const navigate = useNavigate();
  return (
    <RegisterScreen
      onDone={(role) => navigate({ to: role === "shipper" ? "/request" : "/driver" })}
    />
  );
}
