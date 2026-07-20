import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation as useRouterLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MapPin,
  ChevronDown,
  Search,
  Mic,
  Wallet,
  Bell,
  BellOff,
  X,
  ShoppingCart,
} from "lucide-react";
import { useCart } from "@food/context/CartContext";
import { cn } from "@/lib/utils";
import { Switch } from "@food/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@food/components/ui/popover";
import { Badge } from "@food/components/ui/badge";
import useNotificationInbox from "@food/hooks/useNotificationInbox";

const tabs = [
  { id: "food", name: "Food", shortName: "Food" },
  { id: "quick", name: "Quick Commerce", shortName: "Quick" },
  { id: "porter", name: "Porter", shortName: "Porter" },
];

const TAB_GLYPHS = { food: "🍔", quick: "📦", porter: "🚚" };

const foodTheme = (vegMode) => ({
  accent: vegMode ? "#2e7d32" : "#FF0000",
});

const isMeaningfulLocationValue = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return Boolean(
    normalized &&
    normalized !== "select location" &&
    normalized !== "current location",
  );
};

const buildLocationDisplay = (savedAddressText, location) => {
  if (isMeaningfulLocationValue(savedAddressText)) {
    const parts = String(savedAddressText)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length >= 3) {
      return {
        title: parts.slice(0, 2).join(", "),
        subtitle: parts.slice(2).join(", "),
      };
    }

    if (parts.length === 2) {
      return {
        title: parts.join(", "),
        subtitle: "Tap to choose delivery location",
      };
    }

    return {
      title: String(savedAddressText).trim(),
      subtitle: "Tap to choose delivery location",
    };
  }

  const fallbackTitle = location?.area || location?.city || "Select Location";
  const fallbackSubtitle =
    location?.address || location?.city || "Tap to choose delivery location";

  return {
    title: fallbackTitle,
    subtitle: fallbackSubtitle,
  };
};

const isColorDark = (color) => {
  if (!color || !color.startsWith("#")) return false;
  let c = color.substring(1);
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  const rgb = parseInt(c, 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 0) & 0xff;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 140;
};

export default function HomeHeader({
  activeTab,
  setActiveTab,
  location,
  savedAddressText,
  handleLocationClick,
  handleSearchFocus,
  placeholderIndex,
  placeholders,
  vegMode = false,
  onVegModeChange,
  quickThemeColor,
  onQuickTabIntent,
  bannerComponent,
  embedded = false,
}) {
  const navigate = useNavigate();
  const { cart } = useCart();
  const cartItemCount = cart?.reduce((total, item) => total + (item.quantity || 1), 0) || 0;
  const [isListening, setIsListening] = useState(false);
  const routerLocation = useRouterLocation();
  const headerRef = useRef(null);
  const FIXED_QUICK_THEME_COLOR = "#FF0000";

  const [notifications, setNotifications] = useState(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem("food_user_notifications");
    return saved ? JSON.parse(saved) : [];
  });

  const {
    items: broadcastNotifications,
    unreadCount: broadcastUnreadCount,
    dismiss: dismissBroadcastNotification,
  } = useNotificationInbox("user", { limit: 20 });

  useEffect(() => {
    const sync = () => {
      const saved = localStorage.getItem("food_user_notifications");
      setNotifications(saved ? JSON.parse(saved) : []);
    };
    window.addEventListener("notificationsUpdated", sync);
    return () => window.removeEventListener("notificationsUpdated", sync);
  }, []);

  const isPorter = activeTab === "porter";
  const theme =
    activeTab === "quick"
      ? { accent: FIXED_QUICK_THEME_COLOR }
      : isPorter
        ? { accent: "#FF0000" }
        : foodTheme(vegMode);
  const isFood = activeTab === "food";
  const isLightChrome = isFood || isPorter;
  const isDarkTheme = !isLightChrome && isColorDark(theme.accent);
  const textColorClass = isLightChrome
    ? "text-gray-900"
    : isDarkTheme
      ? "text-white"
      : "text-gray-900";
  const subtextColorClass = isLightChrome
    ? "text-gray-500"
    : isDarkTheme
      ? "text-white/80"
      : "text-gray-600";
  const iconColor = isLightChrome
    ? theme.accent
    : isDarkTheme
      ? "#ffffff"
      : "#111827";

  const walletPath =
    activeTab === "quick"
      ? "/quick/wallet"
      : activeTab === "porter"
        ? "/food/user/wallet?from=porter"
        : "/food/user/wallet";

  const { title: locationTitle, subtitle: locationSubtitle } = useMemo(
    () => buildLocationDisplay(savedAddressText, location),
    [savedAddressText, location],
  );

  const mergedNotifications = useMemo(() => {
    const localItems = Array.isArray(notifications)
      ? notifications.map((item) => ({ ...item, source: "local" }))
      : [];
    const remoteItems = (broadcastNotifications || []).map((item) => ({
      ...item,
      id: item.id || item._id,
      source: "broadcast",
      time: item.createdAt
        ? new Date(item.createdAt).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : "Just now",
    }));
    return [...remoteItems, ...localItems].sort(
      (a, b) =>
        new Date(b.createdAt || b.timestamp || 0).getTime() -
        new Date(a.createdAt || a.timestamp || 0).getTime(),
    );
  }, [broadcastNotifications, notifications]);

  const unreadCount =
    notifications.filter((item) => !item.read).length + broadcastUnreadCount;

  const removeNotification = (id, source) => {
    if (source === "broadcast") {
      dismissBroadcastNotification(id);
      return;
    }
    setNotifications((prev) => {
      const next = prev.filter((item) => item.id !== id);
      localStorage.setItem("food_user_notifications", JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("notificationsUpdated"));
      return next;
    });
  };

  const openSearch = () => {
    if (handleSearchFocus) {
      handleSearchFocus();
      return;
    }
    if (activeTab === "quick") {
      navigate("/quick/search");
      return;
    }
    navigate("/food/user/search");
  };

  return (
    <motion.div
      ref={headerRef}
      className={cn(
        "relative z-50 border-none pb-0 outline-none transition-colors duration-300 md:hidden",
        isLightChrome ? "bg-white" : "bg-transparent",
      )}
      style={!isLightChrome ? { backgroundColor: theme.accent } : undefined}
    >
      <header
        className={cn(
          "px-3 py-2.5 outline-none transition-colors duration-300 sm:px-4 sm:py-3",
          isLightChrome
            ? "border-b border-gray-100 bg-white"
            : "border-b-0 border-none",
        )}
        style={!isLightChrome ? { backgroundColor: "transparent" } : undefined}
      >
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleLocationClick}
            className="flex min-w-0 flex-1 items-center gap-2 border-0 bg-transparent p-0 text-left outline-none"
          >
            <MapPin
              className="h-4 w-4 shrink-0 sm:h-5 sm:w-5"
              style={{ color: iconColor }}
              strokeWidth={2}
            />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center">
                <span
                  className={cn(
                    "truncate text-xs font-bold sm:text-sm",
                    "max-w-[7.5rem] sm:max-w-[12rem]",
                    textColorClass,
                  )}
                >
                  {embedded ? savedAddressText || locationTitle : locationTitle}
                </span>
                {!embedded && (
                  <ChevronDown
                    className={cn("ml-1 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4", textColorClass)}
                    strokeWidth={2}
                  />
                )}
              </div>
              {!embedded && (
                <span
                  className={cn(
                    "block truncate text-[9px] uppercase sm:text-[10px]",
                    "max-w-[8.5rem] sm:max-w-[14rem]",
                    subtextColorClass,
                  )}
                >
                  {locationSubtitle}
                </span>
              )}
            </div>
          </button>

          {!embedded && (
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <Link
                to="/food/user/cart"
                className={cn(
                  "relative rounded-full p-1.5 transition-all hover:scale-105 active:scale-95 sm:p-2",
                  isLightChrome
                    ? "bg-gray-100 text-gray-700"
                    : isDarkTheme
                      ? "bg-white/20 text-white"
                      : "bg-black/5 text-gray-800",
                )}
                aria-label="Open cart"
              >
                <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2} />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#FF0000] text-[10px] font-bold text-white">
                    {cartItemCount > 9 ? "9+" : cartItemCount}
                  </span>
                )}
              </Link>

              <Link
                to={walletPath}
                className={cn(
                  "rounded-full p-1.5 transition-all hover:scale-105 active:scale-95 sm:p-2",
                  isLightChrome
                    ? "bg-gray-100 text-gray-700"
                    : isDarkTheme
                      ? "bg-white/20 text-white"
                      : "bg-black/5 text-gray-800",
                )}
                aria-label="Open wallet"
              >
                <Wallet className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2} />
              </Link>

              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "relative rounded-full border-0 p-1.5 outline-none transition-all hover:scale-105 active:scale-95 sm:p-2",
                      isLightChrome
                        ? "bg-gray-100 text-gray-700"
                        : isDarkTheme
                          ? "bg-white/20 text-white"
                          : "bg-black/5 text-gray-800",
                    )}
                    aria-label="Open notifications"
                  >
                    <Bell className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2} />
                    {unreadCount > 0 && (
                      <span className="absolute right-1 top-1 h-2 w-2 rounded-full border border-white bg-[#FF0000]" />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="z-[200] mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border-none p-0 shadow-2xl"
                  align="end"
                >
                  <div className="bg-white">
                    <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 p-4">
                      <h3 className="flex items-center gap-2 font-bold text-gray-900">
                        Notifications
                        {unreadCount > 0 && (
                          <Badge
                            variant="secondary"
                            className="h-4 border-none bg-red-100 text-[10px] text-red-600"
                          >
                            {unreadCount} New
                          </Badge>
                        )}
                      </h3>
                      <Link to="/food/user/notifications" className="text-xs font-bold text-red-600">
                        {mergedNotifications.length > 0 ? "View All" : ""}
                      </Link>
                    </div>
                    <div className="custom-scrollbar max-h-80 overflow-y-auto sm:max-h-96">
                      {mergedNotifications.length > 0 ? (
                        mergedNotifications.slice(0, 5).map((item, index) => (
                          <div
                            key={item.id || `notif-${index}`}
                            className="flex items-start gap-3 border-b border-gray-50 p-4 last:border-0"
                          >
                            <div className="mt-1 rounded-full bg-red-100 p-2 text-red-600">
                              <Bell className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="mb-0.5 flex items-center justify-between gap-2">
                                <span className="truncate text-sm font-bold text-gray-900">
                                  {item.title}
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className="whitespace-nowrap text-[10px] text-gray-400">
                                    {item.time}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      removeNotification(item.id, item.source);
                                    }}
                                    className="rounded-full border-0 bg-transparent p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                              <p className="line-clamp-2 text-xs leading-relaxed text-gray-500">
                                {item.message}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex flex-col items-center gap-2 p-8 text-center">
                          <BellOff className="h-10 w-10 text-gray-300" />
                          <p className="text-xs font-medium text-gray-400">All caught up!</p>
                        </div>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </header>

      {!embedded && (
        <>
          <div className="flex gap-1.5 px-3 py-2 sm:gap-2 sm:px-4">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const handleTabIntent = () => {
                if (tab.id === "quick") onQuickTabIntent?.();
              };
              const handleTabClick = () => {
                if (tab.route) {
                  const redirectTo = `${routerLocation.pathname || "/food/user"}${routerLocation.search || ""}${routerLocation.hash || ""}`;
                  navigate(tab.route, { state: { redirectTo } });
                  return;
                }
                setActiveTab?.(tab.id);
              };

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={handleTabClick}
                  onMouseEnter={handleTabIntent}
                  onTouchStart={handleTabIntent}
                  onFocus={handleTabIntent}
                  className={cn(
                    "flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center rounded-[8px] border-0 px-1 py-2 font-bold transition-all duration-300 sm:px-2",
                    isActive
                      ? isLightChrome
                        ? "border-0 text-white shadow-lg"
                        : isDarkTheme
                          ? "border border-white/30 text-white shadow-lg"
                          : "border border-black/20 text-gray-900 shadow-lg"
                      : isLightChrome
                        ? "border-0 bg-gray-100 text-gray-500 hover:bg-gray-200"
                        : isDarkTheme
                          ? "border-0 bg-white/10 text-white hover:bg-white/20"
                          : "border-0 bg-black/5 text-gray-700 hover:bg-black/10",
                  )}
                  style={
                    isActive
                      ? {
                          backgroundColor: theme.accent,
                          boxShadow:
                            tab.id === "quick"
                              ? "0 10px 15px -3px rgba(0,0,0,0.15)"
                              : "0 10px 15px -3px rgba(255,0,0,0.2)",
                        }
                      : undefined
                  }
                >
                  <div className="mb-0.5 flex h-5 w-5 items-center justify-center text-[18px] leading-none sm:text-[20px]">
                    {TAB_GLYPHS[tab.id] || "🍔"}
                  </div>
                  <span className="w-full truncate text-center text-[9px] font-bold uppercase tracking-wide sm:text-[10px]">
                    <span className="sm:hidden">{tab.shortName}</span>
                    <span className="hidden sm:inline">{tab.name}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {isFood && (
            <div className="px-3 py-2 sm:px-4 sm:py-3">
              <div className="relative flex w-full items-center">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3">
                  <Search className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: theme.accent }} strokeWidth={2} />
                </div>

                <button
                  type="button"
                  onClick={openSearch}
                  className="block w-full cursor-pointer rounded-[8px] border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-[5.5rem] text-left text-xs font-normal text-gray-900 placeholder:text-gray-400 focus:border-brand-orange focus:ring-brand-orange sm:py-3 sm:pl-10 sm:pr-28 sm:text-sm"
                >
                  <span className="block truncate text-gray-400">
                    {placeholders?.[placeholderIndex] || "Search for food, groceries..."}
                  </span>
                </button>

                <div className="absolute inset-y-0 right-0 z-20 flex items-center gap-1.5 pr-2 sm:gap-2 sm:pr-3">
                  <button
                    type="button"
                    onClick={openSearch}
                    style={{ color: theme.accent }}
                    className={cn(
                      "border-0 bg-transparent p-1 transition-all hover:scale-105 active:scale-95",
                      isListening && "animate-pulse",
                    )}
                    aria-label="Voice search"
                  >
                    <Mic className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2} />
                  </button>

                  <div className="hidden h-5 w-px bg-gray-300 sm:block" />

                  <div className="flex items-center gap-1 pl-0.5 sm:pl-1">
                    <span className="hidden text-[10px] font-bold uppercase text-[#2e7d32] min-[380px]:inline">
                      Veg
                    </span>
                    <div className="flex h-5 scale-[0.78] items-center sm:scale-[0.8]">
                      <Switch
                        checked={vegMode}
                        onCheckedChange={onVegModeChange}
                        className="border-none data-[state=checked]:bg-[#2e7d32] data-[state=unchecked]:bg-gray-200"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </>
      )}
    </motion.div>
  );
}
