// Porter standalone layout shell. Renders the routed screen + bottom nav.
import React, { useEffect, useMemo } from "react";
import { Outlet, useLocation } from "react-router-dom";
import PorterBottomNav from "./components/layout/BottomNav";

import QuickFooter from "@/modules/quickCommerce/user/components/layout/Footer";

const SHOW_NAV_PATHS = new Set(["/porter", "/porter/shipments", "/porter/saved-places"]);

const UserLayout = React.memo(() => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  const showNav = useMemo(() => SHOW_NAV_PATHS.has(location.pathname), [location.pathname]);

  return (
    <div className="min-h-screen bg-[#FAF7F2] dark:bg-[#0a0a0a] flex flex-col">
      <main className={showNav ? "pb-[80px] flex-1" : "flex-1"}>
        <Outlet />
      </main>
      <div className="hidden md:block w-full">
        <QuickFooter themeColor="#2563EB" />
      </div>
      {showNav && <PorterBottomNav />}
    </div>
  );
});

UserLayout.displayName = "PorterUserLayout";

export default UserLayout;
