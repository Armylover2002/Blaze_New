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
    <div className="fixed bottom-0 left-0 right-0 z-[500] flex h-[70px] items-center justify-around border-t border-gray-100 bg-white/85 px-4 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(0,0,0,0.06)] backdrop-blur-xl md:hidden dark:bg-card/80 dark:border-border">
      {navItems.map((item) => {
        const active = isActive(item);
        return (
          <Link key={item.id} to={item.path} className="group relative flex h-full flex-1 flex-col items-center justify-center">
            <motion.div animate={{ y: active ? -2 : 0, scale: active ? 1.1 : 1 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
              <item.icon size={24} strokeWidth={active ? 2.5 : 2} className={cn("transition-colors", active ? "text-[#FF0000]" : "text-gray-400")} />
            </motion.div>
            <span className={cn("mt-1 text-[10px] font-bold tracking-tight transition-colors", active ? "text-[#FF0000]" : "text-gray-400")}>{item.label}</span>
            {active && <motion.div layoutId="porterTopLine" className="absolute -top-[1px] h-[3px] w-8 rounded-full bg-[#FF0000]" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
          </Link>
        );
      })}
    </div>
  );
};

export default React.memo(PorterBottomNav);
