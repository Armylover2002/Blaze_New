import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Package, MapPin, ChevronRight, Truck, Clock, Search, UtensilsCrossed, ShoppingBag, Star, ArrowRight, ChevronDown, ShieldCheck, Lock, Zap } from "lucide-react";
import { Skeleton } from "@food/components/ui/skeleton";
import { cn } from "@/lib/utils";
import BannerSection from "../../../Food/components/user/home/BannerSection";

const tabs = [
  { 
    id: "food", 
    title: "FOOD", 
    subtitle: "FROM RESTAURANTS", 
    discount: "UPTO 30% OFF",
    image: "/super-app/food.png",
    icon: UtensilsCrossed,
    route: "/food/user"
  },
  { 
    id: "quick", 
    title: "INSTAMART", 
    subtitle: "INSTANT GROCERY", 
    discount: "UPTO 20% OFF",
    image: "/super-app/grocery.png",
    icon: ShoppingBag,
    route: "/quick"
  },
  { 
    id: "porter", 
    title: "PORTER", 
    subtitle: "SEND PACKAGES", 
    discount: "UPTO 50% OFF",
    image: "/super-app/taxi.png",
    icon: Star,
    route: "/porter"
  },
];
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
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-[#2563EB]/30 bg-[#EFF6FF]/50 p-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2563EB]/10">
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
        <div key={b.id} onClick={() => onBannerClick(b)} className="w-[100vw] min-w-[100vw] snap-center shrink-0 cursor-pointer">
          <div className="w-full relative h-[140px] sm:h-44 bg-gray-100">
            <img src={b.image} alt={b.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent flex flex-col justify-end p-4 pb-8">
               <h3 className="text-white font-extrabold text-xl leading-tight drop-shadow-md">{b.title}</h3>
               {b.subtitle && <p className="text-white/95 text-[13px] mt-1 font-semibold drop-shadow-md">{b.subtitle}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function VehicleIcon({ iconUrl, name, className, style }) {
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt={name}
        className={className || "h-12 w-12 rounded-lg object-contain bg-gray-50 drop-shadow-sm p-1"}
        style={style}
        loading="lazy"
      />
    );
  }
  return (
    <div className={className || "flex h-12 w-12 items-center justify-center rounded-lg bg-gray-50 shadow-sm border border-gray-100"}>
      <Truck className="h-6 w-6 text-[#2563EB]" />
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
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

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

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 350, damping: 25 } }
  };

  return (
    <div className={`min-h-screen bg-[#FAF7F2] dark:bg-[#0a0a0a] ${embedded ? "pb-24" : "pb-28"}`}>
      <motion.main 
        className="pb-4"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Banner + Search section matching Food module */}
        <motion.div variants={itemVariants} className="relative z-10 w-full pt-2 md:pt-0">
          <div
            className="relative overflow-hidden shadow-sm pb-3.5 rounded-[20px] md:rounded-none mx-3 sm:mx-4 md:mx-0 mt-0"
            style={{
              background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
            }}
          >
            <div className="h-[130px] sm:h-36 md:h-[450px] lg:h-[500px] mt-0 relative z-10 w-full px-0">
               {/* Mobile Slider */}
               <div className="block md:hidden h-full w-full">
                 {!isLoading && banners.length > 0 && (
                    <BannerCarousel banners={banners} onBannerClick={handleBannerClick} />
                 )}
               </div>
               {/* Desktop Slider */}
               <div className="hidden md:block absolute inset-0 z-0">
                 {!isLoading && banners.length > 0 && (
                    <BannerSection
                      showBannerSkeleton={isLoading}
                      heroBannerImages={banners.map(b => b.image)}
                      heroBannersData={banners}
                      currentBannerIndex={banners.length ? currentBannerIndex % banners.length : 0}
                      setCurrentBannerIndex={setCurrentBannerIndex}
                      navigate={navigate}
                      hideOverlay={true}
                    />
                 )}
               </div>
               {/* Overlay Text for Desktop */}
               <div className="hidden md:flex absolute inset-0 flex-col items-center justify-center text-white text-center z-10 px-4 mt-[-60px] pointer-events-none">
                 <h1 className="text-3xl lg:text-4xl font-bold mb-3 drop-shadow-md">
                   Fast & reliable delivery <br /> for all your packages.
                 </h1>
                 <p className="text-xl lg:text-2xl font-bold drop-shadow-md">Deliver It! 🚚</p>
               </div>
            </div>

            {/* Banner Search and Location */}
            <div className="px-4 pt-0 -mt-2 relative z-20 md:hidden">
              <div className="flex w-full items-center bg-white rounded-full shadow-md overflow-hidden relative pr-2 border border-gray-100">
                {/* Location */}
                <button
                  type="button"
                  onClick={() => navigate(getPorterAddressPath())}
                  className="flex items-center gap-1.5 px-4 py-3 bg-transparent border-0 hover:bg-gray-50 transition-colors shrink-0 max-w-[140px]"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-[#2563EB]" strokeWidth={2.5} />
                  <div className="flex items-center min-w-0">
                    <span className="truncate text-xs font-bold text-gray-800">
                      {pickup?.title || "Select Location"}
                    </span>
                    <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 text-gray-800" strokeWidth={2.5} />
                  </div>
                </button>

                <div className="h-6 w-px bg-gray-200 shrink-0" />

                {/* Search */}
                <button
                  type="button"
                  className="flex-1 flex items-center justify-between px-3 py-3 bg-transparent border-0 text-left hover:bg-gray-50 transition-colors min-w-0"
                >
                  <span className="block truncate text-xs text-gray-400 font-medium w-full">
                    Search...
                  </span>
                  <Search className="h-4 w-4 shrink-0 text-gray-400 ml-2" strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Content Wrapper for Desktop */}
        <div className="w-full md:max-w-7xl md:mx-auto md:px-4 lg:px-8">
          {/* TABS SECTION / CARDS SECTION */}
          <motion.div variants={itemVariants} className="grid grid-cols-3 gap-2 px-3 sm:px-4 mt-5 md:mt-8 md:gap-4 md:px-0 md:flex md:justify-center md:items-center">
            {tabs.map((tab) => {
              const isActive = tab.id === "porter";
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => navigate(tab.route)}
                  className={cn(
                    "relative overflow-hidden shadow-sm transition-all duration-300 text-left w-full border",
                    "rounded-[16px] p-2 sm:p-2.5 h-[85px] min-[380px]:h-[95px]",
                    "md:rounded-[20px] md:h-[120px] md:w-[280px] md:p-0",
                    isActive 
                      ? "bg-blue-50/80 border-blue-200 shadow-sm scale-[1.02]" 
                      : tab.id === "food"
                      ? "bg-rose-50/60 border-rose-100 hover:bg-rose-50 hover:border-rose-200 hover:shadow-md hover:scale-[1.01]"
                      : tab.id === "quick"
                      ? "bg-amber-50/60 border-amber-100 hover:bg-amber-50 hover:border-amber-200 hover:shadow-md hover:scale-[1.01]"
                      : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-md hover:scale-[1.01]"
                  )}
                >
                  {/* MOBILE CONTENT (Original Layout) */}
                  <div className="flex flex-col justify-between h-full md:hidden">
                    {/* Top content */}
                    <div className="flex gap-1.5 w-full items-start z-10">
                      <div className={`text-white rounded-full p-1 shrink-0 flex items-center justify-center h-[20px] w-[20px] mt-0.5 ${isActive ? 'bg-[#2563EB]' : tab.id === 'food' ? 'bg-[#FF0000]' : 'bg-[#F97316]'}`}>
                        <tab.icon className="h-3 w-3" strokeWidth={2.5} />
                      </div>
                      <div className="flex flex-col min-w-0 mt-0.5">
                        <span className="text-[9.5px] min-[380px]:text-[10.5px] sm:text-[12px] font-bold text-gray-900 leading-tight truncate">
                          {tab.title}
                        </span>
                        <p className="text-[7px] sm:text-[8px] font-medium text-gray-500 uppercase tracking-tight mt-0.5 truncate">
                          {tab.subtitle}
                        </p>
                      </div>
                    </div>

                    {/* Bottom content: arrow and image */}
                    <div className="mt-1 flex items-end justify-between w-full z-10">
                      <div className={`text-white rounded-full p-1 shrink-0 flex items-center justify-center h-4 w-4 shadow-sm mb-0.5 ${isActive ? 'bg-[#2563EB]' : tab.id === 'food' ? 'bg-[#FF0000]' : 'bg-[#F97316]'}`}>
                        <ArrowRight className="h-2.5 w-2.5" strokeWidth={3} />
                      </div>
                      <div className="absolute right-[-4px] bottom-[-4px] w-[55px] h-[55px] min-[380px]:w-[65px] min-[380px]:h-[65px] pointer-events-none">
                        <img src={tab.image} className="w-full h-full object-contain mix-blend-multiply" alt={tab.title} />
                      </div>
                    </div>
                  </div>

                  {/* DESKTOP CONTENT (New Layout) */}
                  <div className="hidden md:flex justify-between h-full w-full p-4">
                    {/* Left Content (Text and Arrow) */}
                    <div className="flex flex-col justify-between h-full z-10 w-[65%]">
                      {/* Icon + Text */}
                      <div className="flex items-start gap-2">
                        <div className={`text-white rounded-full p-1.5 shrink-0 flex items-center justify-center md:h-[28px] md:w-[28px] ${isActive ? 'bg-[#2563EB]' : tab.id === 'food' ? 'bg-[#FF0000]' : 'bg-[#F97316]'}`}>
                          <tab.icon className="md:h-4 md:w-4" strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="md:text-[15px] font-extrabold text-gray-900 leading-tight truncate tracking-tight">
                            {tab.title}
                          </span>
                          <p className="md:text-[9px] font-bold text-gray-500 uppercase tracking-wider mt-0.5 truncate">
                            {tab.subtitle}
                          </p>
                        </div>
                      </div>

                      {/* Arrow Button */}
                      <div className={`text-white rounded-full shrink-0 flex items-center justify-center md:h-6 md:w-6 shadow-sm ${isActive ? 'bg-[#2563EB]' : tab.id === 'food' ? 'bg-[#FF0000]' : 'bg-[#F97316]'}`}>
                        <ArrowRight className="md:h-3.5 md:w-3.5" strokeWidth={3} />
                      </div>
                    </div>

                    {/* Right Content (Image) */}
                    <div className="absolute right-0 bottom-0 top-0 md:w-[45%] pointer-events-none flex items-end justify-end md:pr-4 md:pb-2">
                      <img src={tab.image} className="md:w-[100px] md:h-[100px] object-contain mix-blend-multiply" alt={tab.title} />
                    </div>
                  </div>
                </button>
              );
            })}
          </motion.div>

        {showVehicles && (
          <motion.section variants={itemVariants} className="px-4 mt-5 md:mt-4">
            <SectionLabel>Delivery vehicles</SectionLabel>
            <p className="text-[11px] sm:text-[12px] font-medium text-gray-500 mb-3 mt-[-4px]">Choose the best delivery option for your needs</p>
            <div className="grid grid-cols-2 gap-3 md:flex md:justify-center md:gap-6 md:px-0">
              {isLoading
                ? Array.from({ length: FEATURED_VEHICLE_LIMIT }).map((_, i) => (
                    <VehicleCardSkeleton key={`vehicle-skeleton-${i}`} />
                  ))
                : featuredVehicles.map((v) => {
                    const isBike = v.name.toLowerCase().includes('bike');
                    return (
                      <motion.button
                        key={v.id}
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate(getPorterAddressPath())}
                        className={cn(
                          "flex flex-col overflow-hidden relative text-left group shadow-sm hover:shadow-md transition-shadow",
                          "rounded-[20px] border border-gray-100 bg-white", // Mobile
                          "md:rounded-[16px] md:border md:w-[380px] lg:w-[420px] shrink-0", // Desktop
                          isBike ? 'md:bg-[#FFF8F8] md:border-[#FFEBEB]' : 'md:bg-[#F8FAFF] md:border-[#EBF2FF]'
                        )}
                      >
                        {/* MOBILE LAYOUT (Original) */}
                        <div className="flex flex-col w-full md:hidden">
                          {/* Shimmer Effect Overlay */}
                          <motion.div 
                            className="absolute top-0 bottom-0 w-[150%] z-40 bg-gradient-to-r from-transparent via-white/50 to-transparent skew-x-12 pointer-events-none"
                            animate={{ x: ["-100%", "200%"] }}
                            transition={{ repeat: Infinity, duration: 2, ease: "linear", repeatDelay: 3 }}
                          />

                          {/* Top Background Area */}
                          <div className={`w-full h-[95px] relative flex justify-center items-center overflow-hidden ${isBike ? 'bg-[#FFECEC]' : 'bg-[#EEF5FF]'}`}>
                            {/* Badge */}
                            <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1 shadow-sm z-20">
                              <ShieldCheck className={`h-3 w-3 ${isBike ? 'text-[#E53935]' : 'text-[#3B82F6]'}`} />
                              <span className={`text-[9px] font-bold ${isBike ? 'text-[#E53935]' : 'text-[#3B82F6]'}`}>
                                {isBike ? 'Fast Delivery' : 'Heavy Duty'}
                              </span>
                            </div>
                            
                            {/* Floating Image */}
                            <motion.div 
                              animate={{ y: [0, -3, 0] }}
                              transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut", delay: isBike ? 0 : 0.5 }}
                              className="w-full h-full pt-4 pb-1 relative z-10 flex items-center justify-center mix-blend-multiply" 
                              style={{ mixBlendMode: 'multiply' }}
                            >
                              <VehicleIcon iconUrl={v.iconUrl} name={v.name} className="h-full w-full object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-110" style={{ mixBlendMode: 'multiply' }} />
                            </motion.div>
                          </div>

                          {/* Bottom Content Area */}
                          <div className="p-2 sm:p-2.5 w-full bg-white flex flex-col gap-2 relative z-20 transition-colors duration-300 group-hover:bg-gray-50/50">
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-[10px] shrink-0 ${isBike ? 'bg-[#FFECEC] text-[#E53935]' : 'bg-[#EEF5FF] text-[#3B82F6]'}`}>
                                <Truck className="h-4 w-4" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <p className="text-[14px] sm:text-[15px] font-black tracking-tight text-gray-800 leading-none truncate">{v.name}</p>
                                <p className="text-[9px] sm:text-[9.5px] font-medium text-gray-500 mt-0.5 leading-tight line-clamp-1">{isBike ? 'Quick & efficient delivery' : 'For heavy deliveries'}</p>
                              </div>
                            </div>
                            <div className={`w-full rounded-[10px] py-1.5 flex items-center justify-center gap-1.5 border ${isBike ? 'bg-[#FFECEC]/50 border-[#E53935]/20 text-[#E53935]' : 'bg-[#EEF5FF]/50 border-[#3B82F6]/20 text-[#3B82F6]'}`}>
                              <Lock className="h-3 w-3" />
                              <span className="text-[11px] font-bold tracking-tight">Up to {v.maxWeight} kg</span>
                            </div>
                          </div>
                        </div>

                        {/* DESKTOP LAYOUT (Horizontal) */}
                        <div className="hidden md:flex flex-col w-full h-full justify-between">
                          {/* Top Content Area */}
                          <div className="flex w-full h-[100px] relative">
                            {/* Left text area */}
                            <div className="flex-1 flex flex-col pt-3 pl-4 z-10">
                              {/* Top Badge */}
                              <div className={`w-fit bg-white rounded-full px-2 py-0.5 flex items-center gap-1.5 border mb-1.5 ${isBike ? 'text-[#E53935] border-[#FFEBEB]' : 'text-[#3B82F6] border-[#EBF2FF]'}`}>
                                {isBike ? <Zap className="h-2.5 w-2.5" /> : <ShieldCheck className="h-2.5 w-2.5" />}
                                <span className="text-[9px] font-bold">
                                  {isBike ? 'Fast Delivery' : 'Heavy Duty'}
                               </span>
                              </div>
                              
                              <h3 className={`text-xl font-extrabold tracking-tight leading-none mb-1 lowercase ${isBike ? 'text-[#D32F2F]' : 'text-[#1976D2]'}`}>
                                {v.name}
                              </h3>
                              <p className="text-[10px] font-medium text-gray-500 leading-tight">
                                {isBike ? 'Quick & efficient delivery' : 'For heavy deliveries'}
                              </p>
                            </div>
                            
                            {/* Right image area with colored circle */}
                            <div className="w-[120px] relative overflow-hidden flex items-center justify-center shrink-0">
                              {/* Colored circular background */}
                              <div className={`absolute top-0 right-0 w-[140px] h-[140px] rounded-tl-full rounded-bl-full translate-x-8 z-0 ${isBike ? 'bg-[#FFEEEE]' : 'bg-[#EDF4FF]'}`} />
                              
                              {/* Vehicle Image */}
                              <motion.div 
                                animate={{ y: [0, -2, 0] }}
                                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut", delay: isBike ? 0 : 0.5 }}
                                className="w-full h-full p-2 relative z-10 flex items-center justify-center mix-blend-multiply mr-3 mt-1" 
                              >
                                <VehicleIcon iconUrl={v.iconUrl} name={v.name} className="h-20 w-20 object-contain transition-transform duration-500 group-hover:scale-105" style={{ mixBlendMode: 'multiply' }} />
                              </motion.div>
                            </div>
                          </div>

                          {/* Bottom Full-Width Button Area */}
                          <div className="px-3 pb-3 w-full z-10">
                             <div className={`w-full rounded-[10px] py-1.5 flex items-center justify-center gap-1.5 transition-colors border ${isBike ? 'bg-[#FFEBEB]/80 hover:bg-[#FFEBEB] text-[#D32F2F] border-[#FFD6D6]' : 'bg-[#EBF2FF]/80 hover:bg-[#EBF2FF] text-[#1976D2] border-[#D6E4FF]'}`}>
                               <Lock className="h-3.5 w-3.5" />
                               <span className="text-[11px] font-bold tracking-tight">Up to {v.maxWeight} kg</span>
                             </div>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
            </div>
          </motion.section>
        )}

        <motion.div variants={itemVariants} className="px-4 mt-6">
          <SectionLabel>Map</SectionLabel>
          <div className="overflow-hidden rounded-[20px] bg-white shadow-sm border border-gray-100">
            <PorterHomeMap height={220} className="rounded-[20px]" />
            {pickup?.address && (
              <div className="border-t border-gray-100 px-4 py-3 bg-white">
                <p className="text-[11px] font-bold uppercase text-gray-400">Pickup</p>
                <p className="text-[14px] font-bold text-gray-900">{pickup.title || "Current Location"}</p>
                <p className="truncate text-[12px] text-gray-500">{pickup.address}</p>
              </div>
            )}

          </div>
        </motion.div>

        {showOffers && (
          <motion.section variants={itemVariants} className="px-4 mt-6">
            <div className="mb-2 flex items-center justify-between">
              <SectionLabel className="mb-0">Offers for you</SectionLabel>
              <button type="button" onClick={() => navigate(getPorterPromoPath())} className="text-[12px] font-bold text-[#2563EB]">
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
                      className="relative w-full flex items-center bg-white border border-[#E2E8F0] rounded-[20px] shadow-[0_4px_16px_rgba(0,0,0,0.03)] overflow-hidden cursor-pointer transition hover:shadow-md hover:border-[#3B82F6]/40 group"
                    >
                      {/* Decorative background circle */}
                      <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-[#EEF5FF] transition duration-500 group-hover:scale-[2] pointer-events-none"></div>
                      
                      <div className="p-3.5 pl-4 flex items-center w-full z-10">
                        {/* Icon container */}
                        <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#3B82F6] to-[#2563EB] shadow-sm shadow-blue-200">
                          <span className="text-white font-black text-lg leading-none">%</span>
                        </div>
                        
                        <div className="ml-3.5 flex-1 min-w-0 pr-2">
                          <div className="flex flex-col">
                            <p className="text-[14.5px] font-bold text-gray-900 tracking-tight leading-none mb-1">
                              {coupon.code}
                            </p>
                            <p className="text-[11.5px] font-medium text-gray-500 leading-tight">
                              {getDiscountSubtext(coupon)} on your next ride
                            </p>
                          </div>
                        </div>
                        
                        <div className="ml-1 pl-3 py-2 border-l-2 border-dashed border-gray-100 flex flex-col items-center justify-center">
                          <span className="text-[10.5px] font-extrabold text-[#2563EB] uppercase tracking-wide">Apply</span>
                        </div>
                      </div>
                    </div>
                  ))}
            </div>
          </motion.section>
        )}

        {recentShipment && (
          <motion.section variants={itemVariants} className="px-4 mt-5">
            <div className="mb-2 flex items-center justify-between">
              <SectionLabel className="mb-0">Recent Shipment</SectionLabel>
              <button type="button" onClick={() => navigate('/porter/shipments')} className="text-[12px] font-bold text-[#2563EB]">
                View history
              </button>
            </div>
            <div
              onClick={() => navigate(getPorterShipmentDetailsPath(recentShipment.id))}
              className="flex flex-col rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition hover:border-[#2563EB]/30 hover:shadow-md cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2 mb-3 border-b border-gray-50 pb-3">
                <p className="text-[13px] font-bold text-gray-900">#{recentShipment.orderNumber}</p>
                <span className={`text-[11px] font-bold uppercase ${["delivered", "completed"].includes(recentShipment.status) ? "text-green-600" : "text-[#2563EB]"}`}>
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
                    <div className="absolute -left-[18.5px] top-1.5 h-2 w-2 rounded-full border-2 border-[#2563EB] bg-white"></div>
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
          </motion.section>
        )}
        </div>

      </motion.main>

      <BottomSheet
        open={!!selectedCoupon}
        onClose={() => setSelectedCoupon(null)}
        title="Coupon Details"
      >
        {selectedCoupon && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-dashed border-[#2563EB]/30 bg-[#EFF6FF] p-5 text-center relative overflow-hidden">
              <div className="absolute top-1/2 -left-3 h-6 w-6 -translate-y-1/2 rounded-full bg-white"></div>
              <div className="absolute top-1/2 -right-3 h-6 w-6 -translate-y-1/2 rounded-full bg-white"></div>
              <div className="text-3xl mb-2">🎉</div>
              <h3 className="text-xl font-black text-gray-900 uppercase tracking-widest">{selectedCoupon.code}</h3>
              <p className="text-[14px] font-bold text-[#2563EB] mt-1">
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
