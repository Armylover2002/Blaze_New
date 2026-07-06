import React from "react";
import { motion } from "framer-motion";
import { MapPin, Navigation } from "lucide-react";

export default function MapPreview({ className = "", height = 220, showRoute = false, animateCar = false, pin = false, rounded = "rounded-2xl" }) {
  return (
    <div className={`relative overflow-hidden ${rounded} ${className}`} style={{ height }}>
      <div className="absolute inset-0 bg-[#e8eef0]" />
      <div className="absolute -left-6 top-6 h-20 w-28 rounded-2xl bg-[#cfe8d2]/80" />
      <div className="absolute right-4 bottom-8 h-24 w-24 rounded-2xl bg-[#cfe8d2]/70" />
      <div className="absolute right-0 top-0 h-16 w-32 rounded-bl-3xl bg-[#bcd8ea]/80" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <g stroke="#ffffff" strokeWidth="6" vectorEffect="non-scaling-stroke" opacity="0.9" fill="none">
          <line x1="-10" y1="38" x2="110" y2="30" />
          <line x1="20" y1="-10" x2="34" y2="110" />
          <line x1="-10" y1="78" x2="110" y2="86" />
          <line x1="74" y1="-10" x2="64" y2="110" />
        </g>
        {showRoute && (
          <motion.path d="M 15 85 L 35 70 L 60 45 L 85 25" fill="none" stroke="#FF0000" strokeWidth="4" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: "easeInOut" }} />
        )}
      </svg>
      {showRoute && (
        <>
          <div className="absolute" style={{ left: '15%', top: '85%', transform: 'translate(-50%, -50%)' }}><span className="block h-3.5 w-3.5 rounded-full bg-[#2e7d32] ring-4 ring-[#2e7d32]/20" /></div>
          <div className="absolute" style={{ left: '85%', top: '25%', transform: 'translate(-50%, -100%)' }}><MapPin className="h-7 w-7 text-gray-900 fill-white drop-shadow" strokeWidth={2.2} /></div>
        </>
      )}
      {animateCar && (
        <motion.div className="absolute" style={{ transform: 'translate(-50%, -50%)' }} initial={{ left: '15%', top: '85%' }} animate={{ left: ['15%', '35%', '60%', '85%'], top: ['85%', '70%', '45%', '25%'] }}
          transition={{ duration: 6, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }}>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FF0000] text-white shadow-lg">
            <Navigation className="h-4 w-4 fill-current" style={{ transform: 'rotate(45deg)' }} />
          </div>
        </motion.div>
      )}
      {pin && !showRoute && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
          <MapPin className="h-9 w-9 text-[#FF0000] fill-white drop-shadow-lg" strokeWidth={2.2} />
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/5 to-transparent" />
    </div>
  );
}
