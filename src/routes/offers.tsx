import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { PhoneFrame, AppHeader } from "@/components/hamoula/PhoneFrame";
import { VoiceBanner } from "@/components/hamoula/Voice";
import { findTruck } from "@/lib/hamoula-data";
import { useHamoula } from "@/lib/hamoula-store";
import { NearbyDrivers } from "@/components/hamoula/NearbyDrivers";

export const Route = createFileRoute("/offers")({
  head: () => ({
    meta: [
      { title: "أصحاب الشاحنات القريبين | مول طرانسبور" },
      {
        name: "description",
        content: "شوف أصحاب الشاحنات القريبين من نقطة التحميل مرتبين حسب المسافة، وتواصل معهم مباشرة.",
      },
      { property: "og:title", content: "أصحاب الشاحنات القريبين | مول طرانسبور" },
      {
        property: "og:description",
        content: "لائحة أصحاب الشاحنات مرتبة من الأقرب للأبعد مع المسافة بالكيلومتر.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OffersPage,
});

function OffersPage() {
  const navigate = useNavigate();
  const { profile, request, activeLoad } = useHamoula();

  // Drivers live in their own feed.
  useEffect(() => {
    if (profile.role === "driver") navigate({ to: "/driver" });
  }, [profile.role, navigate]);

  const truckLabel = findTruck(request.truck).label;

  return (
    <PhoneFrame>
      <AppHeader
        title="أصحاب الشاحنات"
        showBack
        backTo="/"
        subtitle={`${request.pickup.split(" - ")[0]} ← ${request.destination.split(" - ")[0]} · ${truckLabel}`}
      />

      <div className="flex-1 space-y-4 px-5 py-5">
        <VoiceBanner message="الشاحنات مرتبة من الأقرب ليك للأبعد — تواصل مباشرة مع الشيفور اللي عجبك" />

        <NearbyDrivers
          pickup={activeLoad?.pickupPoint ?? request.pickupPoint}
          truckId={activeLoad?.truck ?? request.truck}
        />

        <Link
          to="/request"
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-border py-3 text-sm font-bold text-muted-foreground"
        >
          <ArrowRight className="size-4" />
          تعديل الطلب
        </Link>
      </div>
    </PhoneFrame>
  );
}
