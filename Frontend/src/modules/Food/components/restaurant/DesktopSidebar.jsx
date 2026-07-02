import React, { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Store,
  LayoutDashboard,
  FileText,
  Calendar,
  History,
  Book,
  LayoutGrid,
  Truck,
  Receipt,
  MessageSquare,
  Clock,
  Map,
  Bell,
  LifeBuoy,
  ShieldCheck,
  LogOut
} from "lucide-react";
import { restaurantAPI } from "@food/api";
import { getAppLogo, getCompanyName } from "@common/utils/businessSettings";
import useNotificationInbox from "@food/hooks/useNotificationInbox";
import { clearModuleAuth } from "@food/utils/auth";

const extractRestaurantPayload = (response) =>
  response?.data?.data?.restaurant ||
  response?.data?.restaurant ||
  response?.data?.data?.user ||
  response?.data?.user ||
  response?.data?.data ||
  null;

export default function DesktopSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [restaurantData, setRestaurantData] = useState(null);
  const [companyName, setCompanyName] = useState(() => getCompanyName() || "rj kitchen");
  const [logoUrl, setLogoUrl] = useState(() => getAppLogo("restaurant"));
  const { unreadCount } = useNotificationInbox("restaurant", { limit: 20, pollMs: 5 * 60 * 1000 });

  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        const response = await restaurantAPI.getCurrentRestaurant();
        const data = extractRestaurantPayload(response);
        if (data) {
          setRestaurantData(data);
        }
      } catch (error) {
        // Silently handle
      }
    };
    fetchRestaurantData();
  }, []);

  const restaurantName = restaurantData?.name || companyName || "rj kitchen";
  const ownerName = restaurantData?.ownerName || restaurantData?.name || "Afasd"; // Fallback from screenshot

  const sections = [
    {
      title: "OPERATIONS",
      items: [
        { name: "Live orders", path: "/food/restaurant", icon: FileText, exact: true },
        { name: "Reservations", path: "/food/restaurant/reservations", icon: Calendar },
        { name: "Order history", path: "/food/restaurant/orders/all", icon: History },
      ]
    },
    {
      title: "MENU",
      items: [
        { name: "Menu inventory", path: "/food/restaurant/inventory", icon: Book },
        { name: "Categories", path: "/food/restaurant/menu-categories", icon: LayoutGrid },
      ]
    },
    {
      title: "BUSINESS",
      items: [
        { name: "Delivery", path: "/food/restaurant/delivery-settings", icon: Truck },
        { name: "Accounting", path: "/food/restaurant/hub-finance", icon: Receipt },
        { name: "Feedback", path: "/food/restaurant/feedback", icon: MessageSquare },
      ]
    },
    {
      title: "OUTLET",
      items: [
        { name: "Outlet info", path: "/food/restaurant/outlet-info", icon: Store },
        { name: "Hours & status", path: "/food/restaurant/outlet-timings", icon: Clock },
        { name: "Zone setup", path: "/food/restaurant/zone-setup", icon: Map },
      ]
    },
    {
      title: "ACCOUNT",
      items: [
        { name: "Notifications", path: "/food/restaurant/notifications", icon: Bell, badge: unreadCount },
        { name: "Support", path: "/food/restaurant/help-centre/support", icon: LifeBuoy },
        { name: "FSSAI", path: "/food/restaurant/fssai", icon: ShieldCheck },
      ]
    }
  ];

  const onLogout = async () => {
    try {
      clearModuleAuth("restaurant");
      navigate("/food/restaurant/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 bg-white border-r border-gray-100 shadow-[2px_0_10px_rgba(0,0,0,0.02)] z-50">
      {/* Header */}
      <div className="p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-cover rounded-xl" />
            ) : (
              <Store className="w-5 h-5 text-green-600" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-gray-900 text-sm truncate">{restaurantName}</span>
            <span className="text-xs text-gray-500 truncate">Restaurant panel</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-6 custom-scrollbar overscroll-none">
        {sections.map((section, idx) => (
          <div key={idx}>
            <h3 className="text-[11px] font-bold text-gray-400 mb-2 uppercase tracking-wider px-2">
              {section.title}
            </h3>
            <ul className="space-y-1">
              {section.items.map((item, itemIdx) => {
                const isActive = item.exact 
                  ? location.pathname === item.path || location.pathname === item.path + "/"
                  : location.pathname.startsWith(item.path);
                  
                return (
                  <li key={itemIdx}>
                    <NavLink
                      to={item.path}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 ${
                        isActive
                          ? "bg-green-50 text-green-700"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className={`w-4 h-4 ${isActive ? "text-green-600" : "text-gray-400"}`} />
                        <span className={`text-sm ${isActive ? "font-semibold" : "font-medium"}`}>
                          {item.name}
                        </span>
                      </div>
                      {item.badge > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer Profile */}
      <div className="p-4 bg-white border-t border-gray-100">
        <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-xl mb-3">
          <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
            {ownerName.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-gray-900 text-sm truncate">{ownerName}</span>
            <span className="text-xs text-gray-500 truncate">Owner</span>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
