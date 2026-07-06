import { Clock, MapPin, Star, Utensils, Leaf } from "lucide-react";
import { Badge } from "@food/components/ui/badge";

export default function RestaurantDetailsSummary({
  restaurant,
  isRestaurantOffline,
  isOutOfService,
}) {
  const cuisines = Array.isArray(restaurant?.cuisines) && restaurant.cuisines.length > 0
    ? restaurant.cuisines.slice(0, 3).join(" · ")
    : restaurant?.topCategory || restaurant?.cuisine || "Multi-cuisine";

  const isPureVeg = restaurant?.pureVegRestaurant === true;

  return (
    <section className="px-4 sm:px-6 -mt-8 relative z-10">
      <div className="max-w-7xl mx-auto">
        <div className="rounded-3xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-gray-800 shadow-[0_12px_40px_rgba(0,0,0,0.08)] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {isPureVeg && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 text-green-700 border border-green-200 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide">
                    <Leaf className="h-3 w-3" />
                    Pure Veg
                  </span>
                )}
                {restaurant?.priceRange && (
                  <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                    {restaurant.priceRange}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">
                {restaurant?.name || "Restaurant"}
              </h1>

              <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Utensils className="h-4 w-4 shrink-0" />
                <span className="truncate">{cuisines}</span>
              </div>
            </div>

            <div className="flex flex-col items-center shrink-0">
              <div className="flex items-center gap-1 rounded-xl bg-[#FF0000] text-white px-3 py-1.5 shadow-md">
                <Star className="h-4 w-4 fill-white" />
                <span className="text-base font-bold">{restaurant?.rating || "4.5"}</span>
              </div>
              <span className="text-[11px] text-gray-500 mt-1 font-medium">
                {(restaurant?.reviews || 0).toLocaleString()}+ ratings
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-2.5 rounded-2xl bg-gray-50 dark:bg-[#252525] px-3.5 py-3">
              <div className="h-9 w-9 rounded-xl bg-white dark:bg-[#1a1a1a] flex items-center justify-center shadow-sm">
                <MapPin className="h-4 w-4 text-[#FF0000]" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Distance</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                  {restaurant?.distance || "—"} · {restaurant?.location || "Nearby"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-2xl bg-gray-50 dark:bg-[#252525] px-3.5 py-3">
              <div className="h-9 w-9 rounded-xl bg-white dark:bg-[#1a1a1a] flex items-center justify-center shadow-sm">
                <Clock className="h-4 w-4 text-[#FF0000]" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Delivery</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {restaurant?.deliveryTime || "25-30 mins"}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-center rounded-2xl bg-gray-50 dark:bg-[#252525] px-3.5 py-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Status</p>
                <Badge
                  className={`mt-1 ${
                    isRestaurantOffline || isOutOfService
                      ? "bg-rose-100 text-rose-700 border-rose-200"
                      : "bg-emerald-100 text-emerald-700 border-emerald-200"
                  }`}
                >
                  {isOutOfService ? "Out of zone" : isRestaurantOffline ? "Offline" : "Open now"}
                </Badge>
              </div>
            </div>
          </div>

          {(isRestaurantOffline || isOutOfService) && (
            <p className="mt-4 text-sm font-medium text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
              {isOutOfService
                ? "You are outside the delivery zone. Change your location to order."
                : "This restaurant is currently offline. You can browse the menu but cannot place orders."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
