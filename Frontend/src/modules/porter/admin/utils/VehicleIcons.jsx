import React from 'react';

// Common base for all icons
const IconWrapper = ({ children, className = "" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 100 100" 
    className={`w-full h-full ${className}`}
  >
    {children}
  </svg>
);

// Colorful SVG definitions
export const BikeIcon = ({ className }) => (
  <IconWrapper className={className}>
    <circle cx="25" cy="70" r="15" fill="#374151" />
    <circle cx="25" cy="70" r="8" fill="#9CA3AF" />
    <circle cx="75" cy="70" r="15" fill="#374151" />
    <circle cx="75" cy="70" r="8" fill="#9CA3AF" />
    <path d="M25 70 L45 40 L70 40 L75 70" fill="none" stroke="#EF4444" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M45 40 L35 30 L40 25" fill="none" stroke="#1F2937" strokeWidth="5" strokeLinecap="round" />
    <path d="M70 40 L65 25 M60 25 L70 25" fill="none" stroke="#1F2937" strokeWidth="5" strokeLinecap="round" />
    <rect x="35" y="40" width="20" height="15" rx="3" fill="#3B82F6" />
  </IconWrapper>
);

export const EVBikeIcon = ({ className }) => (
  <IconWrapper className={className}>
    <circle cx="25" cy="70" r="15" fill="#374151" />
    <circle cx="25" cy="70" r="8" fill="#10B981" />
    <circle cx="75" cy="70" r="15" fill="#374151" />
    <circle cx="75" cy="70" r="8" fill="#10B981" />
    <path d="M25 70 L45 40 L70 40 L75 70" fill="none" stroke="#34D399" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M45 40 L35 30 L40 25" fill="none" stroke="#1F2937" strokeWidth="5" strokeLinecap="round" />
    <path d="M70 40 L65 25 M60 25 L70 25" fill="none" stroke="#1F2937" strokeWidth="5" strokeLinecap="round" />
    <path d="M45 50 L42 55 H48 L45 60" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </IconWrapper>
);

export const ScooterIcon = ({ className }) => (
  <IconWrapper className={className}>
    <circle cx="25" cy="75" r="12" fill="#374151" />
    <circle cx="25" cy="75" r="5" fill="#D1D5DB" />
    <circle cx="75" cy="75" r="12" fill="#374151" />
    <circle cx="75" cy="75" r="5" fill="#D1D5DB" />
    <path d="M25 75 L35 35 L45 35 M30 30 L40 30" fill="none" stroke="#1F2937" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M35 75 H65 C70 75 75 70 75 60 C75 50 65 50 55 50 L45 60" fill="#F59E0B" />
    <rect x="50" y="40" width="20" height="10" rx="3" fill="#1F2937" />
  </IconWrapper>
);

export const BicycleIcon = ({ className }) => (
  <IconWrapper className={className}>
    <circle cx="25" cy="70" r="16" fill="none" stroke="#374151" strokeWidth="4" />
    <circle cx="75" cy="70" r="16" fill="none" stroke="#374151" strokeWidth="4" />
    <path d="M25 70 L45 40 L70 40 L75 70 M45 40 L55 70 L70 40" fill="none" stroke="#3B82F6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="55" cy="70" r="4" fill="#1F2937" />
    <path d="M45 40 L40 30 L45 28" fill="none" stroke="#1F2937" strokeWidth="4" strokeLinecap="round" />
    <path d="M70 40 L65 25 M60 25 L70 25" fill="none" stroke="#1F2937" strokeWidth="4" strokeLinecap="round" />
  </IconWrapper>
);

export const AutoRickshawIcon = ({ className }) => (
  <IconWrapper className={className}>
    <circle cx="25" cy="75" r="12" fill="#374151" />
    <circle cx="75" cy="75" r="12" fill="#374151" />
    <path d="M15 75 C15 50 30 30 50 30 L80 40 L85 75 Z" fill="#FCD34D" />
    <path d="M15 75 C15 50 30 30 50 30 L80 40" fill="none" stroke="#16A34A" strokeWidth="4" />
    <rect x="50" y="40" width="25" height="15" rx="2" fill="#93C5FD" />
    <rect x="25" y="45" width="20" height="15" rx="2" fill="#93C5FD" />
    <rect x="15" y="30" width="65" height="5" fill="#1F2937" />
  </IconWrapper>
);

export const PickupIcon = ({ className }) => (
  <IconWrapper className={className}>
    <rect x="10" y="55" width="80" height="15" rx="3" fill="#3B82F6" />
    <path d="M15 55 L15 35 C15 30 20 25 30 25 L45 25 L55 55 Z" fill="#60A5FA" />
    <path d="M20 50 L20 32 L40 32 L48 50 Z" fill="#BFDBFE" />
    <rect x="55" y="40" width="30" height="15" fill="#94A3B8" />
    <circle cx="30" cy="75" r="12" fill="#1F2937" />
    <circle cx="70" cy="75" r="12" fill="#1F2937" />
    <circle cx="30" cy="75" r="6" fill="#D1D5DB" />
    <circle cx="70" cy="75" r="6" fill="#D1D5DB" />
    <rect x="10" y="65" width="5" height="5" fill="#FBBF24" />
    <rect x="85" y="60" width="5" height="5" fill="#EF4444" />
  </IconWrapper>
);

export const TataAceIcon = ({ className }) => (
  <IconWrapper className={className}>
    <path d="M10 70 L90 70 L90 55 L70 55 L65 30 L30 30 L30 55 L10 55 Z" fill="#10B981" />
    <path d="M35 55 L35 35 L60 35 L63 55 Z" fill="#A7F3D0" />
    <rect x="65" y="30" width="25" height="25" fill="#D1D5DB" />
    <circle cx="25" cy="75" r="10" fill="#374151" />
    <circle cx="75" cy="75" r="10" fill="#374151" />
    <rect x="10" y="65" width="5" height="5" fill="#FBBF24" />
  </IconWrapper>
);

export const MiniTruckIcon = ({ className }) => (
  <IconWrapper className={className}>
    <rect x="40" y="30" width="50" height="35" rx="2" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="2" />
    <path d="M10 65 L40 65 L40 35 C40 30 35 30 30 30 L15 45 L10 65 Z" fill="#F87171" />
    <path d="M15 55 L20 45 L35 45 L35 55 Z" fill="#FECACA" />
    <circle cx="25" cy="75" r="10" fill="#1F2937" />
    <circle cx="75" cy="75" r="10" fill="#1F2937" />
  </IconWrapper>
);

export const TruckIcon = ({ className }) => (
  <IconWrapper className={className}>
    <rect x="35" y="25" width="55" height="40" rx="3" fill="#FCD34D" />
    <path d="M10 65 L35 65 L35 35 L20 35 L10 50 Z" fill="#3B82F6" />
    <path d="M15 55 L22 42 L30 42 L30 55 Z" fill="#93C5FD" />
    <circle cx="25" cy="75" r="12" fill="#374151" />
    <circle cx="65" cy="75" r="12" fill="#374151" />
    <circle cx="80" cy="75" r="12" fill="#374151" />
    <rect x="35" y="25" width="55" height="5" fill="#F59E0B" />
  </IconWrapper>
);

export const HeavyTruckIcon = ({ className }) => (
  <IconWrapper className={className}>
    <rect x="40" y="20" width="50" height="45" rx="3" fill="#D1D5DB" stroke="#9CA3AF" strokeWidth="2" />
    <path d="M10 65 L40 65 L40 25 L25 25 L10 45 Z" fill="#EF4444" />
    <path d="M15 55 L25 35 L35 35 L35 55 Z" fill="#FECACA" />
    <rect x="30" y="20" width="5" height="15" fill="#9CA3AF" />
    <circle cx="25" cy="75" r="12" fill="#1F2937" />
    <circle cx="55" cy="75" r="12" fill="#1F2937" />
    <circle cx="70" cy="75" r="12" fill="#1F2937" />
    <circle cx="85" cy="75" r="12" fill="#1F2937" />
  </IconWrapper>
);

export const CargoVanIcon = ({ className }) => (
  <IconWrapper className={className}>
    <path d="M10 65 L90 65 C90 65 90 40 85 30 L35 30 L20 45 L10 65 Z" fill="#F3F4F6" stroke="#9CA3AF" strokeWidth="2" />
    <path d="M20 55 L28 42 L40 42 L40 55 Z" fill="#93C5FD" />
    <rect x="10" y="60" width="80" height="5" fill="#3B82F6" />
    <circle cx="25" cy="75" r="11" fill="#374151" />
    <circle cx="75" cy="75" r="11" fill="#374151" />
  </IconWrapper>
);

export const EVVanIcon = ({ className }) => (
  <IconWrapper className={className}>
    <path d="M10 65 L90 65 C90 65 90 40 85 30 L35 30 L20 45 L10 65 Z" fill="#F0FDF4" stroke="#86EFAC" strokeWidth="2" />
    <path d="M20 55 L28 42 L40 42 L40 55 Z" fill="#6EE7B7" />
    <rect x="10" y="60" width="80" height="5" fill="#10B981" />
    <path d="M60 45 L57 52 H63 L60 60" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="25" cy="75" r="11" fill="#374151" />
    <circle cx="75" cy="75" r="11" fill="#374151" />
    <circle cx="25" cy="75" r="5" fill="#10B981" />
    <circle cx="75" cy="75" r="5" fill="#10B981" />
  </IconWrapper>
);

export const TempoIcon = ({ className }) => (
  <IconWrapper className={className}>
    <path d="M15 70 L85 70 L85 35 L70 35 L60 20 L25 20 L15 35 Z" fill="#FDE047" />
    <path d="M22 45 L30 28 L55 28 L65 45 Z" fill="#FEF08A" />
    <rect x="25" y="55" width="50" height="5" fill="#EAB308" />
    <circle cx="30" cy="75" r="10" fill="#1F2937" />
    <circle cx="70" cy="75" r="10" fill="#1F2937" />
  </IconWrapper>
);

export const TempoTravellerIcon = ({ className }) => (
  <IconWrapper className={className}>
    <path d="M10 65 L90 65 C90 65 90 35 85 25 L35 25 L20 40 L10 65 Z" fill="#E0F2FE" stroke="#BAE6FD" strokeWidth="2" />
    <path d="M18 55 L26 40 L38 40 L38 55 Z" fill="#7DD3FC" />
    <rect x="42" y="35" width="12" height="20" fill="#7DD3FC" />
    <rect x="58" y="35" width="12" height="20" fill="#7DD3FC" />
    <rect x="74" y="35" width="10" height="20" fill="#7DD3FC" />
    <rect x="10" y="60" width="80" height="5" fill="#0284C7" />
    <circle cx="25" cy="75" r="11" fill="#374151" />
    <circle cx="75" cy="75" r="11" fill="#374151" />
  </IconWrapper>
);

export const MiniBusIcon = ({ className }) => (
  <IconWrapper className={className}>
    <path d="M10 65 L90 65 C95 65 95 30 90 25 L25 25 C15 25 10 35 10 65 Z" fill="#F87171" />
    <rect x="10" y="60" width="80" height="5" fill="#B91C1C" />
    <rect x="20" y="35" width="15" height="15" fill="#FECACA" />
    <rect x="40" y="35" width="15" height="15" fill="#FECACA" />
    <rect x="60" y="35" width="15" height="15" fill="#FECACA" />
    <rect x="80" y="35" width="10" height="15" fill="#FECACA" />
    <circle cx="25" cy="75" r="10" fill="#1F2937" />
    <circle cx="75" cy="75" r="10" fill="#1F2937" />
  </IconWrapper>
);

export const BusIcon = ({ className }) => (
  <IconWrapper className={className}>
    <path d="M5 65 L95 65 C95 65 95 25 90 20 L25 20 C10 20 5 35 5 65 Z" fill="#3B82F6" />
    <rect x="5" y="60" width="90" height="5" fill="#1D4ED8" />
    <rect x="15" y="30" width="12" height="20" fill="#93C5FD" />
    <rect x="32" y="30" width="12" height="20" fill="#93C5FD" />
    <rect x="49" y="30" width="12" height="20" fill="#93C5FD" />
    <rect x="66" y="30" width="12" height="20" fill="#93C5FD" />
    <rect x="83" y="30" width="10" height="20" fill="#93C5FD" />
    <circle cx="25" cy="75" r="12" fill="#1F2937" />
    <circle cx="75" cy="75" r="12" fill="#1F2937" />
  </IconWrapper>
);

export const TrailerIcon = ({ className }) => (
  <IconWrapper className={className}>
    <rect x="35" y="20" width="60" height="45" rx="2" fill="#9CA3AF" />
    <path d="M5 65 L30 65 L30 35 L15 35 L5 45 Z" fill="#3B82F6" />
    <path d="M10 55 L16 42 L25 42 L25 55 Z" fill="#BFDBFE" />
    <circle cx="20" cy="75" r="12" fill="#1F2937" />
    <circle cx="50" cy="75" r="12" fill="#1F2937" />
    <circle cx="65" cy="75" r="12" fill="#1F2937" />
    <circle cx="85" cy="75" r="12" fill="#1F2937" />
  </IconWrapper>
);

export const CraneIcon = ({ className }) => (
  <IconWrapper className={className}>
    <rect x="30" y="45" width="65" height="20" fill="#FCD34D" />
    <path d="M5 65 L25 65 L25 45 L15 45 L5 55 Z" fill="#F59E0B" />
    <path d="M10 55 L15 48 L22 48 L22 55 Z" fill="#FEF3C7" />
    <path d="M35 45 L85 10 L85 15 L35 50 Z" fill="#1F2937" />
    <path d="M85 15 L85 30 M82 30 C82 32 88 32 88 30 Z" fill="none" stroke="#1F2937" strokeWidth="2" />
    <circle cx="20" cy="75" r="12" fill="#374151" />
    <circle cx="50" cy="75" r="12" fill="#374151" />
    <circle cx="80" cy="75" r="12" fill="#374151" />
  </IconWrapper>
);

export const TractorIcon = ({ className }) => (
  <IconWrapper className={className}>
    <path d="M15 65 L55 65 L55 45 L40 45 L40 30 L25 30 L25 45 L15 45 Z" fill="#EF4444" />
    <rect x="28" y="32" width="10" height="10" fill="#FECACA" />
    <rect x="45" y="20" width="5" height="25" fill="#4B5563" />
    <circle cx="25" cy="70" r="15" fill="#1F2937" />
    <circle cx="60" cy="75" r="10" fill="#1F2937" />
    <path d="M60 65 L85 65 L85 55 L65 55 Z" fill="#D1D5DB" />
    <circle cx="80" cy="75" r="10" fill="#1F2937" />
  </IconWrapper>
);

export const DumperIcon = ({ className }) => (
  <IconWrapper className={className}>
    <path d="M35 25 L90 25 L90 50 L35 50 Z" fill="#F59E0B" />
    <path d="M35 25 L45 15 L95 15 L90 25 Z" fill="#FCD34D" />
    <path d="M10 65 L30 65 L30 35 L15 35 L10 45 Z" fill="#3B82F6" />
    <path d="M13 55 L18 42 L25 42 L25 55 Z" fill="#BFDBFE" />
    <rect x="30" y="55" width="60" height="10" fill="#4B5563" />
    <circle cx="20" cy="75" r="12" fill="#1F2937" />
    <circle cx="60" cy="75" r="12" fill="#1F2937" />
    <circle cx="80" cy="75" r="12" fill="#1F2937" />
  </IconWrapper>
);

export const AmbulanceIcon = ({ className }) => (
  <IconWrapper className={className}>
    <path d="M10 65 L90 65 C90 65 90 35 85 25 L35 25 L20 40 L10 65 Z" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth="2" />
    <path d="M18 55 L26 40 L38 40 L38 55 Z" fill="#93C5FD" />
    <rect x="55" y="35" width="20" height="15" fill="#93C5FD" />
    <path d="M45 40 H50 V35 H55 V40 H60 V45 H55 V50 H50 V45 H45 Z" fill="#EF4444" />
    <rect x="45" y="15" width="10" height="5" rx="2" fill="#EF4444" />
    <rect x="10" y="60" width="80" height="3" fill="#EF4444" />
    <circle cx="25" cy="75" r="11" fill="#1F2937" />
    <circle cx="75" cy="75" r="11" fill="#1F2937" />
  </IconWrapper>
);

export const WaterTankerIcon = ({ className }) => (
  <IconWrapper className={className}>
    <rect x="35" y="25" width="55" height="35" rx="15" fill="#60A5FA" />
    <path d="M10 65 L35 65 L35 35 L20 35 L10 50 Z" fill="#F87171" />
    <path d="M15 55 L22 42 L30 42 L30 55 Z" fill="#FECACA" />
    <rect x="30" y="60" width="60" height="5" fill="#4B5563" />
    <circle cx="25" cy="75" r="12" fill="#1F2937" />
    <circle cx="60" cy="75" r="12" fill="#1F2937" />
    <circle cx="80" cy="75" r="12" fill="#1F2937" />
    <path d="M50 42 Q60 52 70 42 T90 42" fill="none" stroke="#BFDBFE" strokeWidth="3" />
  </IconWrapper>
);

export const RefrigeratedTruckIcon = ({ className }) => (
  <IconWrapper className={className}>
    <rect x="35" y="20" width="55" height="45" rx="2" fill="#F3F4F6" stroke="#9CA3AF" strokeWidth="2" />
    <path d="M45 30 L55 30 M45 40 L55 40 M45 50 L55 50" fill="none" stroke="#60A5FA" strokeWidth="3" strokeLinecap="round" />
    <path d="M75 30 L85 30 M75 40 L85 40 M75 50 L85 50" fill="none" stroke="#60A5FA" strokeWidth="3" strokeLinecap="round" />
    <path d="M10 65 L35 65 L35 35 L20 35 L10 50 Z" fill="#3B82F6" />
    <path d="M15 55 L22 42 L30 42 L30 55 Z" fill="#BFDBFE" />
    <circle cx="25" cy="75" r="12" fill="#1F2937" />
    <circle cx="60" cy="75" r="12" fill="#1F2937" />
    <circle cx="75" cy="75" r="12" fill="#1F2937" />
    <rect x="33" y="25" width="4" height="15" fill="#9CA3AF" />
  </IconWrapper>
);

export const ICONS_DICTIONARY = {
  "Bike": BikeIcon,
  "EV Bike": EVBikeIcon,
  "Scooter": ScooterIcon,
  "Bicycle": BicycleIcon,
  "Auto Rickshaw": AutoRickshawIcon,
  "Pickup": PickupIcon,
  "Tata Ace": TataAceIcon,
  "Mini Truck": MiniTruckIcon,
  "Truck": TruckIcon,
  "Heavy Truck": HeavyTruckIcon,
  "Cargo Van": CargoVanIcon,
  "EV Van": EVVanIcon,
  "Tempo": TempoIcon,
  "Tempo Traveller": TempoTravellerIcon,
  "Mini Bus": MiniBusIcon,
  "Bus": BusIcon,
  "Trailer": TrailerIcon,
  "Crane": CraneIcon,
  "Tractor": TractorIcon,
  "Dumper": DumperIcon,
  "Ambulance": AmbulanceIcon,
  "Water Tanker": WaterTankerIcon,
  "Refrigerated Truck": RefrigeratedTruckIcon,
};

export const getIconComponent = (iconName) => {
  return ICONS_DICTIONARY[iconName] || TruckIcon;
};
