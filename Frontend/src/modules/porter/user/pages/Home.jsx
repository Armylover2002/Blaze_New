import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Package, MapPin, ChevronRight, Truck, Clock, Search } from "lucide-react";
import { Skeleton } from "@food/components/ui/skeleton";
import PorterHomeMap from "../components/PorterHomeMap";
import PorterBottomNav from "../components/layout/BottomNav";
import BottomSheet from "../components/BottomSheet";
import { PrimaryButton, SectionLabel, inr } from "../components/ui";
import { useBooking } from "../context/BookingContext";
import { usePorterHomeData } from "../hooks/usePorterHomeData";
import {
  getPorterAddressPath,
  getPorterShipmentDetailsPath,
  getPorterPromoPath
} from "../utils/routes";


import porterUserApi from '../services/userApi';

const FEATURED_VEHICLE_LIMIT = 4;

function VehicleCardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-2.5 w-16" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
    </div>
  );
}

function OfferCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-[#FF0000]/30 bg-[#FFF1F1]/50 p-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FF0000]/10">
         <Skeleton className="h-6 w-6 rounded-md" />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}

function BannerCarousel({ banners, onBannerClick }) {
  if (!banners || banners.length === 0) return null;
  return (
    <div className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar">
      {banners.map(b => (
        <div key={b.id} onClick={() => onBannerClick(b)} className="w-[100vw] min-w-[100vw] px-4 pb-2 snap-center shrink-0 cursor-pointer">
          <div className="w-full rounded-2xl overflow-hidden relative shadow-sm">
            <img src={b.image} alt={b.title} className="w-full h-40 object-cover bg-gray-100" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent flex flex-col justify-end p-5">
               <h3 className="text-white font-extrabold text-xl leading-tight drop-shadow-md">{b.title}</h3>
               {b.subtitle && <p className="text-white/95 text-[13px] mt-1 font-semibold drop-shadow-md">{b.subtitle}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function VehicleIcon({ iconUrl, name }) {
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt={name}
        className="h-12 w-12 rounded-lg object-contain bg-gray-50 drop-shadow-sm p-1"
        loading="lazy"
      />
    );
  }
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-50 shadow-sm border border-gray-100">
      <Truck className="h-6 w-6 text-[#FF0000]" />
    </div>
  );
}

export default function Home({ embedded = false }) {
  const navigate = useNavigate();
  const { pickup } = useBooking();
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const { vehicles, banners, coupons, isLoading } = usePorterHomeData();
  const [recentShipment, setRecentShipment] = useState(null);
  const [loadingShipment, setLoadingShipment] = useState(true);

  React.useEffect(() => {
    porterUserApi.listOrders({ limit: 1 })
      .then(res => {
        if (res && res.records && res.records.length > 0) {
          setRecentShipment(res.records[0]);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingShipment(false));
  }, []);

  const featuredVehicles = useMemo(
    () => vehicles.slice(0, FEATURED_VEHICLE_LIMIT),
    [vehicles],
  );

  const handleBannerClick = React.useCallback((banner) => {
    if (banner.redirectType === 'external' && banner.redirectValue) {
      window.open(banner.redirectValue, '_blank');
    } else if (banner.redirectValue) {
      navigate(banner.redirectValue);
    }
  }, [navigate]);

  const showVehicles = isLoading || featuredVehicles.length > 0;
  const showOffers = isLoading || (coupons && coupons.length > 0);

  const getDiscountText = React.useCallback((coupon) => {
    const type = (coupon?.discountType || '').toLowerCase();
    const value = coupon?.discountValue || 0;
    if (type === 'percentage') return `${value}% OFF`;
    if (type === 'flat') return `FLAT ₹${value} OFF`;
    return '';
  }, []);

  const getDiscountSubtext = React.useCallback((coupon) => {
    const type = (coupon?.discountType || '').toLowerCase();
    const value = coupon?.discountValue || 0;
    if (type === 'percentage') return `Get ${value}% off`;
    if (type === 'flat') return `Flat ₹${value} off`;
    return '';
  }, []);

  return (
    <div className={`min-h-screen bg-[#FAF7F2] dark:bg-[#0a0a0a] ${embedded ? "pb-24" : "pb-28"}`}>
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#1a1a1a]/90 backdrop-blur-md border-b border-gray-100 dark:border-white/10">
        <div className="px-4 py-3">
          <div className="flex w-full items-center relative">
            <Search className="absolute left-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full rounded-full bg-gray-100 dark:bg-[#2a2a2a] py-2 pl-9 pr-4 text-[13px] text-gray-900 dark:text-white outline-none border border-transparent focus:border-gray-200 dark:focus:border-white/10 transition-colors"
            />
          </div>
        </div>
      </header>

      <main className="space-y-5 pb-4">
        {!isLoading && banners.length > 0 && (
           <div className="pt-4"><BannerCarousel banners={banners} onBannerClick={handleBannerClick} /></div>
        )}

        {showVehicles && (
          <section className="px-4 pt-4">
            <SectionLabel>Delivery vehicles</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              {isLoading
                ? Array.from({ length: FEATURED_VEHICLE_LIMIT }).map((_, i) => (
                    <VehicleCardSkeleton key={`vehicle-skeleton-${i}`} />
                  ))
                : featuredVehicles.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => navigate(getPorterAddressPath())}
                      className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm transition hover:border-[#FF0000]/30 hover:shadow-md hover:-translate-y-0.5 relative overflow-hidden"
                    >
                      <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-[#FF0000]/20 to-transparent"></div>
                      <VehicleIcon iconUrl={v.iconUrl} name={v.name} />
                      <div className="mt-3 w-full">
                        <p className="text-[14px] font-bold text-gray-900">{v.name}</p>
                        <p className="text-[11px] font-medium text-[#FF0000] bg-[#FFF1F1] inline-block px-2 py-0.5 rounded-full mt-1">Up to {v.maxWeight} kg</p>
                      </div>
                    </button>
                  ))}
            </div>
          </section>
        )}

        <div className="px-4">
          <SectionLabel>Map</SectionLabel>
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <PorterHomeMap height={320} className="rounded-2xl" />
            {pickup?.address && (
              <div className="border-t border-gray-100 px-4 py-3">
                <p className="text-[11px] font-bold uppercase text-gray-400">Pickup</p>
                <p className="text-[14px] font-bold text-gray-900">{pickup.title || "Current Location"}</p>
                <p className="truncate text-[12px] text-gray-500">{pickup.address}</p>
              </div>
            )}

          </div>
        </div>

        {showOffers && (
          <section className="px-4">
            <div className="mb-2 flex items-center justify-between">
              <SectionLabel className="mb-0">Offers for you</SectionLabel>
              <button type="button" onClick={() => navigate(getPorterPromoPath())} className="text-[12px] font-bold text-[#FF0000]">
                View all
              </button>
            </div>
            <div className="space-y-3">
              {isLoading
                ? Array.from({ length: 2 }).map((_, i) => (
                    <OfferCardSkeleton key={`offer-skeleton-${i}`} />
                  ))
                : coupons.slice(0, 3).map((coupon) => (
                    <div
                      key={coupon.id}
                      onClick={() => setSelectedCoupon(coupon)}
                      className="flex items-center gap-4 rounded-2xl border border-dashed border-[#FF0000]/30 bg-gradient-to-r from-[#FFF1F1] to-white p-4 shadow-sm cursor-pointer transition hover:border-[#FF0000]"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FF0000]/10 text-2xl drop-shadow-sm">
                        🎉
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-extrabold text-gray-900 uppercase tracking-tight">{coupon.code}</p>
                        <p className="text-[12px] font-medium text-gray-600 mt-0.5">
                          {getDiscountSubtext(coupon)} on your next ride
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-[#FF0000]" />
                    </div>
                  ))}
            </div>
          </section>
        )}

        {recentShipment && (
          <section className="px-4 mt-5">
            <div className="mb-2 flex items-center justify-between">
              <SectionLabel className="mb-0">Recent Shipment</SectionLabel>
              <button type="button" onClick={() => navigate('/porter/shipments')} className="text-[12px] font-bold text-[#FF0000]">
                View history
              </button>
            </div>
            <div
              onClick={() => navigate(getPorterShipmentDetailsPath(recentShipment.id))}
              className="flex flex-col rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition hover:border-[#FF0000]/30 hover:shadow-md cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2 mb-3 border-b border-gray-50 pb-3">
                <p className="text-[13px] font-bold text-gray-900">#{recentShipment.orderNumber}</p>
                <span className={`text-[11px] font-bold uppercase ${["delivered", "completed"].includes(recentShipment.status) ? "text-green-600" : "text-[#FF0000]"}`}>
                  {String(recentShipment.status || "").replace(/_/g, " ")}
                </span>
              </div>
              <div className="relative pl-5 mb-2">
                 <div className="absolute left-1.5 top-1.5 bottom-1.5 w-[1px] bg-gray-200"></div>
                 <div className="relative mb-3">
                    <div className="absolute -left-[18.5px] top-1.5 h-2 w-2 rounded-full border-2 border-green-600 bg-white"></div>
                    <p className="text-[12px] text-gray-700 font-medium line-clamp-1">{recentShipment.pickup?.address || "Pickup address"}</p>
                 </div>
                 <div className="relative">
                    <div className="absolute -left-[18.5px] top-1.5 h-2 w-2 rounded-full border-2 border-[#FF0000] bg-white"></div>
                    <p className="text-[12px] text-gray-700 font-medium line-clamp-1">{recentShipment.delivery?.address || "Delivery address"}</p>
                 </div>
              </div>
              <div className="flex items-center justify-between mt-1 pt-2 border-t border-gray-50">
                <p className="text-[14px] font-bold text-gray-900">{inr(recentShipment.pricing?.total ?? 0)}</p>
                <span className="text-[11px] font-medium text-gray-500">
                  {new Date(recentShipment.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            </div>
          </section>
        )}

      </main>

      <BottomSheet
        open={!!selectedCoupon}
        onClose={() => setSelectedCoupon(null)}
        title="Coupon Details"
      >
        {selectedCoupon && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-dashed border-[#FF0000]/30 bg-[#FFF1F1] p-5 text-center relative overflow-hidden">
              <div className="absolute top-1/2 -left-3 h-6 w-6 -translate-y-1/2 rounded-full bg-white"></div>
              <div className="absolute top-1/2 -right-3 h-6 w-6 -translate-y-1/2 rounded-full bg-white"></div>
              <div className="text-3xl mb-2">🎉</div>
              <h3 className="text-xl font-black text-gray-900 uppercase tracking-widest">{selectedCoupon.code}</h3>
              <p className="text-[14px] font-bold text-[#FF0000] mt-1">
                {getDiscountText(selectedCoupon)}
              </p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4 space-y-3">
              {selectedCoupon.name && (
                <div>
                  <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-1">Offer Title</p>
                  <p className="text-[14px] font-medium text-gray-900">{selectedCoupon.name}</p>
                </div>
              )}
              {selectedCoupon.description && (
                <div>
                  <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-1">Description</p>
                  <p className="text-[14px] font-medium text-gray-900">{selectedCoupon.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {Number(selectedCoupon.minOrderValue) > 0 && (
                  <div>
                    <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-1">Min Order</p>
                    <p className="text-[14px] font-medium text-gray-900">{inr(selectedCoupon.minOrderValue)}</p>
                  </div>
                )}
                {String(selectedCoupon.discountType).toLowerCase() === 'percentage' && Number(selectedCoupon.maxDiscount) > 0 && (
                  <div>
                    <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-1">Max Discount</p>
                    <p className="text-[14px] font-medium text-gray-900">{inr(selectedCoupon.maxDiscount)}</p>
                  </div>
                )}
                {selectedCoupon.perUserLimit > 1 && (
                  <div>
                    <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-1">Usage Limit</p>
                    <p className="text-[14px] font-medium text-gray-900">{selectedCoupon.perUserLimit} per user</p>
                  </div>
                )}
                {selectedCoupon.validFrom && (
                  <div>
                    <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-1">Valid From</p>
                    <p className="text-[14px] font-medium text-gray-900">{new Date(selectedCoupon.validFrom).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                )}
              </div>
              
              {(selectedCoupon.firstOrderOnly || selectedCoupon.newCustomerOnly || selectedCoupon.autoApply) && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedCoupon.firstOrderOnly && (
                    <span className="inline-block px-2 py-1 text-[11px] font-bold text-[#2e7d32] bg-green-50 rounded-md border border-[#2e7d32]/20">First Order Only</span>
                  )}
                  {selectedCoupon.newCustomerOnly && (
                    <span className="inline-block px-2 py-1 text-[11px] font-bold text-[#2e7d32] bg-green-50 rounded-md border border-[#2e7d32]/20">New Customer Only</span>
                  )}
                  {selectedCoupon.autoApply && (
                    <span className="inline-block px-2 py-1 text-[11px] font-bold text-[#1976d2] bg-blue-50 rounded-md border border-[#1976d2]/20">Auto Apply</span>
                  )}
                </div>
              )}

              {selectedCoupon.validUntil && (
                <div className="pt-2 border-t border-dashed border-gray-200 mt-2">
                  <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-1">Expires On</p>
                  <p className="text-[14px] font-medium text-gray-900">{new Date(selectedCoupon.validUntil).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </BottomSheet>

      {embedded && (
        <div className="md:hidden">
          <PorterBottomNav />
        </div>
      )}
    </div>
  );
}
