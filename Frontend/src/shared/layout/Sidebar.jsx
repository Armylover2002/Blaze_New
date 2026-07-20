import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/core/context/AuthContext";
import { cn } from "@/lib/utils";
import { HiChevronDown } from "react-icons/hi2";
import {
  getAppLogo,
  getAppFavicon,
  getCompanyName,
  updateBrowserFavicon,
  subscribeBusinessSettings,
} from "@/modules/common/utils/businessSettings";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import AdminModuleSwitcher from "@/shared/components/AdminModuleSwitcher";

const colorMap = {
  indigo:
    "text-indigo-600 bg-indigo-50 border-indigo-100 group-hover:bg-indigo-100/50",
  rose: "text-rose-600 bg-rose-50 border-rose-100 group-hover:bg-rose-100/50",
  amber:
    "text-amber-600 bg-amber-50 border-amber-100 group-hover:bg-amber-100/50",
  blue: "text-blue-600 bg-blue-50 border-blue-100 group-hover:bg-blue-100/50",
  emerald:
    "text-emerald-600 bg-emerald-50 border-emerald-100 group-hover:bg-emerald-100/50",
  violet:
    "text-violet-600 bg-violet-50 border-violet-100 group-hover:bg-violet-100/50",
  cyan: "text-cyan-600 bg-cyan-50 border-cyan-100 group-hover:bg-cyan-100/50",
  orange:
    "text-red-600 bg-red-50 border-red-100 group-hover:bg-red-100/50",
  green:
    "text-green-600 bg-green-50 border-green-100 group-hover:bg-green-100/50",
  sky: "text-sky-600 bg-sky-50 border-sky-100 group-hover:bg-sky-100/50",
  pink: "text-pink-600 bg-pink-50 border-pink-100 group-hover:bg-pink-100/50",
  fuchsia:
    "text-fuchsia-600 bg-fuchsia-50 border-fuchsia-100 group-hover:bg-fuchsia-100/50",
  red: "text-red-600 bg-red-50 border-red-100 group-hover:bg-red-100/50",
  slate:
    "text-slate-600 bg-slate-50 border-slate-100 group-hover:bg-slate-100/50",
  dark: "text-gray-800 bg-gray-100 border-gray-200 group-hover:bg-gray-200/50",
};

const SidebarItem = ({
  item,
  isOpen,
  onToggle,
  isHovered,
  onMouseEnter,
  onMouseLeave,
}) => {
  const location = useLocation();

  const hasChildren = item.children && item.children.length > 0;
  const isChildActive =
    hasChildren &&
    item.children.some((child) => location.pathname === child.path);

  const isSellerPanel = location.pathname.startsWith("/seller");
  const isAdminPanel = location.pathname.startsWith("/admin");
  const isLightSidebar = isSellerPanel || isAdminPanel;

  if (hasChildren) {
    return (
      <div className="space-y-1">
        <button
          onClick={onToggle}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className={cn(
            "w-full flex items-center justify-between rounded-lg px-3 py-2.5 transition-all duration-300 group relative overflow-hidden",
            isChildActive || isOpen
              ? (isSellerPanel
                  ? "bg-red-100/60 text-primary shadow-sm ring-1 ring-red-200/50"
                  : isLightSidebar
                    ? "bg-white/40 text-[#1A1A1A] shadow-sm ring-1 ring-slate-200"
                    : "bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.05)] ring-1 ring-white/10")
              : (isSellerPanel
                  ? "text-red-800/70 hover:text-red-500 hover:bg-red-100/40"
                  : isLightSidebar ? "text-[#5C5247] hover:text-[#1A1A1A]" : "text-gray-400 hover:text-white"),
          )}>
          <AnimatePresence>
            {isHovered && (
              <motion.div
                layoutId="hover-highlight"
                className={cn("absolute inset-0 rounded-lg -z-10", isSellerPanel ? "bg-red-100/50" : isLightSidebar ? "bg-white/50" : "bg-white/5")}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }}
              />
            )}
          </AnimatePresence>

          <div className="flex items-center space-x-2.5 z-10">
            <div
              className={cn(
                "p-1.5 rounded-lg transition-all duration-500 shadow-lg",
                isChildActive || isOpen
                  ? (isSellerPanel ? "bg-red-500 text-white shadow-red-500/40 ring-2 ring-red-500/20" : "bg-primary text-white shadow-primary/40 ring-2 ring-primary/20")
                  : (isSellerPanel
                      ? "bg-white/60 text-red-400/80 group-hover:bg-white group-hover:text-red-500"
                      : isLightSidebar
                        ? "bg-white/60 text-slate-400 group-hover:bg-white group-hover:text-primary"
                        : "bg-white/5 text-gray-500 group-hover:bg-white/10 group-hover:text-gray-300"),
              )}>
              {item.icon && <item.icon className="h-4 w-4" />}
            </div>
            <span
              className={cn(
                "text-xs tracking-tight transition-all duration-300",
                isChildActive || isOpen ? "font-bold" : "font-semibold",
              )}>
              {item.label}
            </span>
          </div>
          <div
            className={cn(
              "transition-all duration-300 z-10",
              isOpen
                ? "rotate-180 text-red-500"
                : (isSellerPanel ? "rotate-0 text-red-400 group-hover:text-red-500" : isLightSidebar ? "rotate-0 text-slate-400 group-hover:text-slate-600" : "rotate-0 text-gray-600 group-hover:text-gray-400"),
            )}>
            <HiChevronDown className="h-4 w-4" />
          </div>
        </button>
        {isOpen && (
          <div className="pl-9 pr-3 py-1 space-y-1 animate-in slide-in-from-top-2 fade-in duration-500">
            {item.children.map((child) => (
              <NavLink
                key={child.path}
                to={child.path}
                end={child.end !== undefined ? child.end : false}
                className={({ isActive }) =>
                  cn(
                    "block text-xs py-1.5 px-2.5 rounded-lg transition-all duration-300 relative",
                    isActive
                      ? (isSellerPanel
                          ? "text-primary font-bold bg-white/60 shadow-sm ring-1 ring-red-200/50"
                          : isLightSidebar
                            ? "text-primary font-bold bg-white/40 shadow-sm ring-1 ring-slate-200"
                            : "text-white font-bold bg-white/10 shadow-sm ring-1 ring-white/5")
                      : (isSellerPanel
                          ? "text-red-800/70 hover:text-red-500 hover:bg-red-100/30"
                          : isLightSidebar ? "text-[#5C5247] hover:text-[#1A1A1A] hover:bg-white/20" : "text-gray-500 hover:text-gray-300 hover:bg-white/5"),
                  )
                }>
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <div className={cn("absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3 rounded-full shadow-[0_0_10px_rgba(242,101,34,0.5)]", isSellerPanel ? "bg-red-500" : "bg-primary")} />
                    )}
                    {child.label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={item.path}
      end={item.end !== undefined ? item.end : false}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={({ isActive }) =>
        cn(
          "flex items-center space-x-2.5 rounded-lg px-3 py-2.5 transition-all duration-300 group relative overflow-hidden",
          isActive
            ? (isSellerPanel ? "bg-red-500 text-white shadow-red-500/30" : "bg-primary text-white shadow-[0_10px_30px_rgba(var(--primary),0.3)]")
            : (isSellerPanel
                ? "text-red-800/70 hover:text-red-500 hover:bg-red-100/40"
                : isLightSidebar ? "text-[#5C5247] hover:text-[#1A1A1A]" : "text-gray-400 hover:text-white"),
        )
      }>
      {({ isActive }) => (
        <>
          <AnimatePresence>
            {isHovered && !isActive && (
              <motion.div
                layoutId="hover-highlight"
                className={cn("absolute inset-0 rounded-lg -z-10", isSellerPanel ? "bg-red-100/50" : isLightSidebar ? "bg-white/50" : "bg-white/5")}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }}
              />
            )}
          </AnimatePresence>

          <div
            className={cn(
              "p-1.5 rounded-lg transition-all duration-500 shadow-md z-10",
              isActive
                ? "bg-white/20 text-white"
                : (isSellerPanel
                    ? "bg-white/60 text-red-400/80 group-hover:bg-white group-hover:text-red-500"
                    : isLightSidebar
                      ? "bg-white/60 text-slate-400 group-hover:bg-white group-hover:text-primary"
                      : "bg-white/5 text-gray-500 group-hover:bg-white/10 group-hover:text-gray-300"),
            )}>
            {item.icon && <item.icon className="h-4 w-4" />}
          </div>
          <span
            className={cn(
              "text-xs tracking-tight transition-all duration-300 z-10",
              isActive ? "font-bold" : "font-semibold",
            )}>
            {item.label}
          </span>
          {isActive && (
            <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/30 rounded-l-full animate-in slide-in-from-right-1" />
          )}
        </>
      )}
    </NavLink>
  );
};

const SidebarContent = ({ items, title, onClose, openMenu, handleToggle, hoveredIdx, setHoveredIdx }) => {
  const location = useLocation();
  const isAdminPanel = location.pathname.startsWith("/admin");
  const isSellerPanel = location.pathname.startsWith("/seller");
  const isLightSidebar = isSellerPanel || isAdminPanel;
  const appType = isAdminPanel ? 'admin' : (isSellerPanel ? 'seller' : 'user');

  const [logoUrl, setLogoUrl] = useState(() => getAppLogo(appType));
  const [companyName, setCompanyName] = useState(() => getCompanyName());

  useEffect(() => {
    const apply = () => {
      setLogoUrl(getAppLogo(appType));
      setCompanyName(getCompanyName());
      const appFav = getAppFavicon(appType);
      if (appFav) updateBrowserFavicon(appFav);
    };
    apply();
    return subscribeBusinessSettings(apply);
  }, [appType]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className={cn(
        "flex-shrink-0 flex h-16 items-center justify-between px-5 border-b z-10",
        isSellerPanel ? "border-red-200/50 bg-red-50/30" : isLightSidebar ? "border-slate-200 bg-white/10" : "border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent"
      )}>
        <div className="flex flex-col justify-center">
          <div className="flex items-center space-x-2.5">
            {logoUrl ? (
              <img src={logoUrl} alt={companyName} className="h-8 w-auto object-contain" />
            ) : (
              <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center text-white shadow-lg transform -rotate-6 hover:rotate-0 transition-all duration-500 ease-out", isSellerPanel ? "bg-red-500 shadow-red-500/30" : "bg-primary shadow-primary/30")}>
                <span className="text-lg font-black italic">{companyName?.charAt(0) || 'Z'}</span>
              </div>
            )}
            {!logoUrl && (
              <h1 className={cn("text-base font-black tracking-tight leading-none", isSellerPanel ? "text-red-950" : isLightSidebar ? "text-[#1A1A1A]" : "text-white")}>
                {companyName || 'App'}
              </h1>
            )}
          </div>
          <span className={cn(
            "text-[9px] font-black uppercase tracking-[0.2em] mt-1.5 inline-block w-fit px-1.5 py-0.5 rounded-sm",
            isSellerPanel ? "bg-red-500 text-white" : isLightSidebar ? "bg-[#1A1A1A] text-white" : "bg-primary text-white"
          )}>
            {title}
          </span>
        </div>

        {/* Mobile Close Button */}
        <button
          onClick={onClose}
          className={cn("p-2 md:hidden transition-colors", isSellerPanel ? "text-red-800 hover:text-red-500" : isLightSidebar ? "text-[#5C5247] hover:text-[#1A1A1A]" : "text-gray-500 hover:text-white")}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav
        data-lenis-prevent
        onMouseLeave={() => setHoveredIdx(null)}
        className={cn(
          "mt-4 px-3 space-y-1.5 flex-1 overflow-y-auto overscroll-contain min-h-0 pb-6 relative z-20",
          isLightSidebar ? "custom-scrollbar" : "custom-scrollbar-dark"
        )}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {isAdminPanel && (
          <div className="mb-4 px-1">
            <p className="px-3 text-[9px] font-black text-gray-600 uppercase tracking-[0.3em] mb-2">
              Module
            </p>
            <AdminModuleSwitcher className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/5 p-1 shadow-none [&>button]:justify-center [&>button]:px-2 [&>button]:py-2 [&>button]:text-[10px] [&>button]:tracking-[0.18em]" />
          </div>
        )}
        <p className={cn("px-3 text-[9px] font-black uppercase tracking-[0.3em] mb-3", isSellerPanel ? "text-red-600/70" : isLightSidebar ? "text-[#7C7062]" : "text-gray-600")}>
          Core Management
        </p>
        <AnimatePresence>
          {items.map((item, idx) => (
            <SidebarItem
              key={idx}
              item={item}
              isOpen={openMenu === item.label}
              onToggle={() => handleToggle(item.label)}
              isHovered={hoveredIdx === idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseEnterWithClose={() => {
                setHoveredIdx(idx);
              }}
              onMouseLeave={() => { }} // Handle in nav container
            />
          ))}
        </AnimatePresence>
      </nav>

      {!isSellerPanel && (
        <div className={cn(
          "p-4 border-t flex-shrink-0",
          isLightSidebar ? "border-slate-200 bg-white/10" : "border-white/5 bg-gradient-to-t from-white/[0.02] to-transparent"
        )}>
          <div className={cn(
            "rounded-lg p-3 shadow-sm border transition-all group cursor-pointer",
            isLightSidebar
                ? "bg-white/40 border-slate-200 hover:bg-white/60 hover:border-slate-300"
                : "bg-white/5 border-white/5 hover:bg-white/[0.08] hover:border-white/10"
          )}>
            <div className="flex items-center space-x-2.5">
              <div className="relative group">
                <div className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-lg group-hover:scale-110 transition-all duration-500",
                  "bg-gradient-to-br from-primary via-indigo-500 to-violet-600"
                )}>
                  A
                </div>
                <div className={cn(
                  "absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white",
                  "bg-emerald-500"
                )}></div>
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-xs font-bold truncate group-hover:text-primary transition-colors", isLightSidebar ? "text-[#1A1A1A]" : "text-white")}>
                  Admin Console
                </p>
                <p className={cn("text-[9px] truncate font-black uppercase tracking-widest", isLightSidebar ? "text-[#7C7062]" : "text-gray-500")}>
                  Super Admin
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Sidebar = ({ items, title, isOpen, onClose }) => {
  const { role } = useAuth();
  const location = useLocation();
  const isSellerPanel = location.pathname.startsWith("/seller");
  const isAdminPanel = location.pathname.startsWith("/admin");
  const isLightSidebar = isSellerPanel || isAdminPanel;
  const [openMenu, setOpenMenu] = useState(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const handleToggle = (label) => {
    setOpenMenu((prev) => (prev === label ? null : label));
  };

  const commonProps = {
    items,
    title,
    onClose,
    openMenu,
    handleToggle,
    hoveredIdx,
    setHoveredIdx
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "fixed left-0 inset-y-0 w-80 border-r shadow-[20px_0_60px_rgba(0,0,0,0.06)] md:flex flex-col z-50 transition-all duration-300",
          isSellerPanel
            ? "bg-[#fffaf2] backdrop-blur-md text-red-950 border-red-200/50"
            : isLightSidebar
              ? "bg-[#ffffffcc] backdrop-blur-md text-[#5C5247] border-slate-200"
              : "bg-[#0a0c10] text-gray-400 border-white/5",
          (role === "admin" || role === "seller") ? "hidden md:flex" : "flex",
        )}
        style={isSellerPanel ? { backgroundColor: '#fffaf2cc' } : isLightSidebar ? { backgroundColor: '#ffffffcc' } : undefined}
      >
        <SidebarContent {...commonProps} />
      </aside>

      {/* Mobile Sidebar (Drawer) */}
      <AnimatePresence mode="wait">
        {isOpen && (
          <div className="fixed inset-0 z-[100] md:hidden">
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
            />

            {/* Outer Container (Fixed Shell - NO TRANSFORM) */}
            <div className="absolute left-0 inset-y-0 w-80 flex flex-col pointer-events-none">
              {/* Inner Animation Wrapper (TRANSFORM APPLIED HERE) */}
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
                className={cn(
                  "flex-1 shadow-2xl flex flex-col pointer-events-auto min-h-0",
                  isSellerPanel
                    ? "bg-[#fffaf2] backdrop-blur-md text-red-950"
                    : isLightSidebar
                      ? "bg-[#ffffffcc] backdrop-blur-md text-[#5C5247]"
                      : "bg-[#0a0c10] text-gray-400"
                )}
                style={isSellerPanel ? { backgroundColor: '#fffaf2cc' } : isLightSidebar ? { backgroundColor: '#ffffffcc' } : undefined}
              >
                <SidebarContent {...commonProps} />
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
