import React, { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Package, Wallet, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { getPorterHomePath, getPorterShipmentsPath, getPorterWalletPath, getPorterProfilePath } from "../../utils/routes";

const PorterBottomNav = () => {
  const location = useLocation();
  const navItems = useMemo(() => [
    { id: "home", label: "Home", icon: Home, path: getPorterHomePath(), match: ["/porter"] },
    { id: "shipments", label: "Shipments", icon: Package, path: getPorterShipmentsPath(), match: ["/porter/shipments"] },
    { id: "wallet", label: "Wallet", icon: Wallet, path: getPorterWalletPath(), match: ["/food/user/wallet"] },
    { id: "account", label: "Account", icon: User, path: getPorterProfilePath(), match: ["/profile"] },
  ], []);

  const isActive = (item) => {
    if (item.id === "home") return location.pathname === "/porter";
    return item.match.some((m) => location.pathname.startsWith(m));
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="relative bg-white dark:bg-[#1a1a1a] border-t border-gray-200 dark:border-gray-800 shadow-lg pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-auto px-2 sm:px-4">
          {navItems.map((item, index) => {
            const active = isActive(item);
            return (
              <React.Fragment key={item.id}>
                <Link to={item.path} className={`flex flex-1 flex-col items-center gap-1.5 px-2 sm:px-3 py-2 transition-all duration-200 relative ${active ? "text-[#2563EB]" : "text-gray-600"}`}>
                  <item.icon className={`h-5 w-5 ${active ? "text-[#2563EB]" : "text-gray-600"}`} style={{ fill: active ? "#2563EB" : "transparent" }} strokeWidth={2} />
                  <span className={`text-xs sm:text-sm font-medium ${active ? "text-[#2563EB] font-semibold" : "text-gray-600"}`}>{item.label}</span>
                  {active && (
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#2563EB] rounded-b-full" />
                  )}
                </Link>
                {index < navItems.length - 1 && (
                  <div className="h-8 w-px bg-gray-300 dark:bg-gray-700" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default React.memo(PorterBottomNav);
