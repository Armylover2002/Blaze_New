import { Link, useLocation, useNavigate } from "react-router-dom"
import { useEffect, useState, useRef } from "react"
import { ChevronDown, ShoppingCart, Wallet, Search, X } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Switch } from "@food/components/ui/switch"
import { useLocation as useLocationHook } from "@food/hooks/useLocation"
import { useCart } from "@food/context/CartContext"
import { useLocationSelector, useSearchOverlay } from "./UserLayout"
import { useProfile } from "@food/context/ProfileContext"
import { FaLocationDot } from "react-icons/fa6"
import { motion } from "framer-motion"
import { useAuth } from "@core/context/AuthContext"
import { cn } from "@/lib/utils"
import {
    loadBusinessSettings,
    getCachedSettings,
    getCompanyName,
    getAppLogo,
    getAppFavicon,
    updateBrowserFavicon,
} from "@common/utils/businessSettings"

const debugError = (...args) => {}

const NAV_TABS = [
    { id: "delivery", label: "Delivery", shortLabel: "Delivery", to: "/food/user", match: "delivery" },
    { id: "quick", label: "Quick", shortLabel: "Quick", to: "/quick", match: "quick" },
    { id: "under250", label: "Under 250", shortLabel: "₹250", to: "/food/user/under-250", match: "under250" },
    { id: "dining", label: "Dining", shortLabel: "Dining", to: "/food/user/dining", match: "dining" },
    { id: "profile", label: "Profile", shortLabel: "Profile", to: null, match: "profile" },
]

export default function DesktopNavbar({ showLogo = true }) {
    const location = useLocation()
    const { isAuthenticated } = useAuth()
    const navigate = useNavigate()
    const { location: userLocation, loading: locationLoading } = useLocationHook()
    const { getCartCount } = useCart()
    const { openLocationSelector } = useLocationSelector()
    const { setSearchValue } = useSearchOverlay()
    const { vegMode, setVegMode } = useProfile()
    const [heroSearch, setHeroSearch] = useState("")
    const [logoUrl, setLogoUrl] = useState(() => getAppLogo("user"))
    const [companyName, setCompanyName] = useState(() => getCompanyName())
    const [hasScrolledPastBanner, setHasScrolledPastBanner] = useState(false)
    const navRef = useRef(null)
    const cartCount = getCartCount()

    const areaName = userLocation?.area?.trim() || null
    const cityName = userLocation?.city || null
    const stateName = userLocation?.state || null
    const mainLocationName = areaName || cityName || "Select"
    const secondaryLocation = areaName
        ? (cityName || "")
        : (cityName && stateName ? `${cityName}, ${stateName}` : cityName || stateName || "")

    const normalizedPath =
        location.pathname.length > 1
            ? location.pathname.replace(/\/+$/, "")
            : location.pathname
    const profileSource = new URLSearchParams(location.search).get("from")
    const isQuick = normalizedPath === "/quick" || normalizedPath.startsWith("/quick/")
    const isDining = location.pathname === "/food/user/dining" || location.pathname === "/food/dining"
    const isUnder250 = location.pathname === "/food/user/under-250" || location.pathname === "/food/under-250"
    const isSharedFoodProfile =
        (normalizedPath === "/profile" || normalizedPath.startsWith("/profile/")) &&
        profileSource !== "quick"
    const isProfile =
        location.pathname.startsWith("/food/user/profile") ||
        location.pathname.startsWith("/food/profile") ||
        isSharedFoodProfile
    const isDelivery =
        !isDining &&
        !isUnder250 &&
        !isProfile &&
        !isQuick &&
        (location.pathname === "/food/user" ||
            location.pathname === "/food" ||
            (location.pathname.startsWith("/food/user") &&
                !location.pathname.includes("/dining") &&
                !location.pathname.includes("/under-250") &&
                !location.pathname.includes("/profile")))
    const isBannerRoute =
        location.pathname === "/food/user/under-250" ||
        location.pathname === "/food/under-250"
    const searchPlaceholder = isQuick
        ? "Search milk, bread, eggs..."
        : "Search restaurants, food..."

    const activeTab = isQuick
        ? "quick"
        : isUnder250
            ? "under250"
            : isDining
                ? "dining"
                : isProfile
                    ? "profile"
                    : "delivery"

    const isTransparentNav = isBannerRoute && !hasScrolledPastBanner

    useEffect(() => {
        const loadLogo = async () => {
            try {
                const cached = getCachedSettings()
                if (cached) {
                    const userLogo = getAppLogo("user")
                    if (userLogo) setLogoUrl(userLogo)
                    const userFav = getAppFavicon("user")
                    if (userFav) updateBrowserFavicon(userFav)
                    if (cached.companyName) setCompanyName(cached.companyName)
                } else {
                    const settings = await loadBusinessSettings()
                    if (settings) {
                        const userLogo = getAppLogo("user")
                        if (userLogo) setLogoUrl(userLogo)
                        const userFav = getAppFavicon("user")
                        if (userFav) updateBrowserFavicon(userFav)
                        if (settings.companyName) setCompanyName(settings.companyName)
                    }
                }
            } catch (error) {
                debugError("Error loading logo:", error)
            }
        }
        loadLogo()

        const handleSettingsUpdate = (e) => {
            const settings = e.detail || getCachedSettings()
            const userLogo = settings?.userLogo?.url || settings?.logo?.url
            const userFav = settings?.userFavicon?.url || settings?.favicon?.url
            if (userLogo) setLogoUrl(userLogo)
            if (userFav) updateBrowserFavicon(userFav)
            if (settings?.companyName) setCompanyName(settings.companyName)
        }
        window.addEventListener("businessSettingsUpdated", handleSettingsUpdate)
        return () => window.removeEventListener("businessSettingsUpdated", handleSettingsUpdate)
    }, [])

    useEffect(() => {
        if (!isBannerRoute) {
            setHasScrolledPastBanner(true)
            return
        }

        const handleScroll = () => {
            const heroShell =
                document.querySelector('[data-home-hero-shell="true"]') ||
                document.querySelector('[data-banner-shell="true"]')
            const navElement = navRef.current

            if (!heroShell || !navElement) {
                setHasScrolledPastBanner(false)
                return
            }

            const heroRect = heroShell.getBoundingClientRect()
            const navHeight = navElement.getBoundingClientRect().height || 0
            setHasScrolledPastBanner(heroRect.bottom <= navHeight)
        }

        handleScroll()
        window.addEventListener("scroll", handleScroll, { passive: true })
        window.addEventListener("resize", handleScroll)
        return () => {
            window.removeEventListener("scroll", handleScroll)
            window.removeEventListener("resize", handleScroll)
        }
    }, [isBannerRoute])

    const handleSearchSubmit = () => {
        if (!heroSearch.trim()) return
        navigate(
            isQuick
                ? `/quick/search?q=${encodeURIComponent(heroSearch.trim())}`
                : `/food/search?q=${encodeURIComponent(heroSearch.trim())}`,
        )
    }

    const getTabHref = (tab) => {
        if (tab.match === "profile") {
            return isAuthenticated ? "/food/user/profile" : "/user/auth/login"
        }
        return tab.to
    }

    return (
        <nav
            ref={navRef}
            className={cn(
                "fixed top-0 left-0 right-0 z-50 hidden flex-col py-1.5 transition-all duration-300 md:flex lg:py-2",
                isTransparentNav
                    ? "border-0 bg-transparent shadow-none"
                    : "border-b border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-[#1a1a1a]",
            )}
        >
            {/* Top row */}
            <div
                className={cn(
                    "w-full",
                    isTransparentNav
                        ? "border-b border-transparent"
                        : "border-b border-gray-100 dark:border-gray-800",
                )}
            >
                <div className="mx-auto w-full max-w-7xl px-3 sm:px-4 lg:px-8">
                    <div className="flex min-h-[3.5rem] flex-wrap items-center gap-2 py-1 md:min-h-[4rem] md:gap-3 lg:flex-nowrap lg:gap-4">
                        {/* Logo + location */}
                        <div className="flex min-w-0 flex-1 items-center gap-2 md:max-w-[42%] lg:max-w-none lg:flex-shrink-0 lg:gap-4 xl:gap-6">
                            {showLogo && (
                                <Link to="/food/user" className="flex flex-shrink-0 items-center justify-center">
                                    {logoUrl ? (
                                        <img
                                            src={logoUrl}
                                            alt={companyName || "Logo"}
                                            className="h-8 w-auto object-contain md:h-10 lg:h-12 xl:h-14"
                                            onError={(e) => {
                                                e.currentTarget.style.display = "none"
                                            }}
                                        />
                                    ) : (
                                        <span className="text-base font-bold text-gray-900 dark:text-white md:text-lg lg:text-xl">
                                            {companyName || "Appzeto"}
                                        </span>
                                    )}
                                </Link>
                            )}

                            <Button
                                variant="ghost"
                                onClick={openLocationSelector}
                                disabled={locationLoading}
                                className="h-auto min-w-0 flex-1 px-0 py-0 hover:bg-transparent lg:flex-shrink-0 lg:flex-none"
                            >
                                {locationLoading ? (
                                    <span className="text-xs font-bold text-black dark:text-white md:text-sm">
                                        Loading...
                                    </span>
                                ) : (
                                    <div className="flex min-w-0 flex-col items-start">
                                        <div className="flex min-w-0 items-center gap-1 md:gap-1.5 lg:gap-2">
                                            <FaLocationDot className="h-4 w-4 flex-shrink-0 text-black dark:text-white md:h-5 md:w-5" />
                                            <span className="truncate text-xs font-bold text-black dark:text-white md:max-w-[8rem] md:text-sm lg:max-w-[12rem] lg:text-base xl:max-w-none">
                                                {mainLocationName}
                                            </span>
                                            <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-black dark:text-white md:h-4 md:w-4" strokeWidth={2.5} />
                                        </div>
                                        {secondaryLocation && (
                                            <span className="mt-0.5 hidden truncate text-[11px] font-semibold text-gray-600 dark:text-gray-400 sm:block md:max-w-[10rem] lg:max-w-[14rem] lg:text-xs xl:max-w-none">
                                                {secondaryLocation}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </Button>
                        </div>

                        {/* Search + veg mode */}
                        <div className="order-3 flex w-full min-w-0 items-center gap-2 md:order-2 md:w-auto md:flex-1 md:max-w-none lg:mx-4 lg:max-w-3xl lg:gap-3 xl:gap-4">
                            <div className="relative min-w-0 flex-1">
                                <div className="rounded-lg border border-transparent bg-gray-100 transition-all duration-300 focus-within:border-[#FF0000]/20 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#FF0000] dark:bg-[#2a2a2a] dark:focus-within:bg-[#1a1a1a]">
                                    <div className="flex items-center px-2.5 py-1.5 md:px-3 md:py-2">
                                        <Search className="mr-2 h-4 w-4 flex-shrink-0 text-gray-500" />
                                        <Input
                                            value={heroSearch}
                                            onChange={(e) => {
                                                const nextValue = e.target.value
                                                setHeroSearch(nextValue)
                                                setSearchValue(nextValue)
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") handleSearchSubmit()
                                            }}
                                            className="h-6 min-w-0 border-0 bg-transparent p-0 text-xs font-medium placeholder:text-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0 md:text-sm"
                                            placeholder={searchPlaceholder}
                                        />
                                        {heroSearch && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="ml-1 h-6 w-6 flex-shrink-0 rounded-full p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                                                onClick={() => setHeroSearch("")}
                                                aria-label="Clear search"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-shrink-0 items-center gap-1.5 md:gap-2">
                                <div className="hidden flex-col items-end lg:flex">
                                    <span className="text-[10px] font-bold leading-none text-gray-700 dark:text-gray-300">VEG</span>
                                    <span className="text-[8px] font-bold leading-none text-gray-500 dark:text-gray-400">MODE</span>
                                </div>
                                <Switch
                                    checked={vegMode}
                                    onCheckedChange={setVegMode}
                                    className="h-5 w-9 data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-300 dark:data-[state=unchecked]:bg-gray-600"
                                    aria-label="Toggle veg mode"
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="order-2 ml-auto flex flex-shrink-0 items-center gap-1 md:order-3 md:ml-0 md:gap-2 lg:gap-3">
                            <Link to="/food/user/wallet">
                                <Button
                                    variant="ghost"
                                    className="h-9 w-9 rounded-full p-0 hover:bg-gray-100 dark:hover:bg-gray-800 md:h-10 md:w-10 lg:h-12 lg:w-12"
                                    title="Wallet"
                                >
                                    <Wallet className="!h-4 !w-4 text-gray-700 dark:text-gray-300 md:!h-5 md:!w-5 lg:!h-6 lg:!w-6" strokeWidth={2} />
                                </Button>
                            </Link>
                            <Link to="/food/user/cart">
                                <Button
                                    variant="ghost"
                                    className="relative h-9 w-9 rounded-full p-0 hover:bg-gray-100 dark:hover:bg-gray-800 md:h-10 md:w-10 lg:h-12 lg:w-12"
                                    title="Cart"
                                >
                                    <ShoppingCart className="!h-4 !w-4 text-gray-700 dark:text-gray-300 md:!h-5 md:!w-5 lg:!h-6 lg:!w-6" strokeWidth={2} />
                                    {cartCount > 0 && (
                                        <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-800 md:h-6 md:w-6">
                                            <span className="text-[10px] font-bold text-white md:text-xs">
                                                {cartCount > 99 ? "99+" : cartCount}
                                            </span>
                                        </span>
                                    )}
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom nav tabs */}
            <div
                className={cn(
                    "w-full pb-2 md:pb-2.5 lg:pb-3",
                    isTransparentNav ? "bg-transparent" : "bg-white dark:bg-[#1a1a1a]",
                )}
            >
                <div className="mx-auto w-full max-w-7xl px-3 sm:px-4 lg:px-8">
                    <div className="flex h-10 items-center justify-center md:h-11 lg:h-12">
                        <div className="scrollbar-hide flex w-full max-w-full items-center justify-start gap-4 overflow-x-auto md:justify-center md:gap-6 lg:gap-10 xl:gap-14">
                            {NAV_TABS.map((tab) => {
                                const isActive = activeTab === tab.match
                                const href = getTabHref(tab)
                                const isProfileTab = tab.match === "profile"

                                return (
                                    <Link
                                        key={tab.id}
                                        to={href}
                                        state={!isAuthenticated && isProfileTab ? { redirectTo: "/food/user/profile" } : undefined}
                                        className={cn(
                                            "relative flex flex-shrink-0 flex-col items-center px-1 py-1 transition-colors",
                                            isActive
                                                ? isProfileTab
                                                    ? "text-red-600 dark:text-red-500"
                                                    : "text-[#FF0000]"
                                                : "text-gray-600 hover:text-[#FF0000] dark:text-gray-400 dark:hover:text-[#FF0000]",
                                        )}
                                    >
                                        <span className="text-[11px] font-bold uppercase tracking-wide md:text-xs lg:text-sm">
                                            <span className="lg:hidden">{tab.shortLabel}</span>
                                            <span className="hidden lg:inline">{tab.label}</span>
                                        </span>
                                        {isActive && (
                                            <motion.div
                                                layoutId="navIndicator"
                                                className={cn(
                                                    "absolute -bottom-2 left-0 right-0 h-0.5",
                                                    isProfileTab ? "bg-red-600 dark:bg-red-500" : "bg-[#FF0000]",
                                                )}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ duration: 0.3 }}
                                            />
                                        )}
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    )
}
