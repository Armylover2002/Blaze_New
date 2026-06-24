import React from 'react';
import { useAuth } from '@core/context/AuthContext';
import {
    HiOutlineLogout,
    HiOutlineUserCircle,
    HiOutlineBell,
    HiOutlineSearch,
    HiOutlineMenu
} from 'react-icons/hi';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { sellerApi } from '@/modules/seller/services/sellerApi';
import { AnimatePresence } from 'framer-motion';
import NotificationPopup from './NotificationPopup';
import { toast } from 'sonner';

const Topbar = ({ onMenuClick }) => {
    const { user, logout, role } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [searchQuery, setSearchQuery] = React.useState('');
    const [notifications, setNotifications] = React.useState([]);
    const [unreadCount, setUnreadCount] = React.useState(0);
    const [showNotifications, setShowNotifications] = React.useState(false);
    const notificationRef = React.useRef(null);

    const isSeller = location.pathname.startsWith('/seller');

    const handleSearchSubmit = (e) => {
        e?.preventDefault();
        const q = (searchQuery || '').trim();
        if (!q) return;
        if (isSeller) {
            navigate(`/seller/products?q=${encodeURIComponent(q)}`);
        }
    };

    const fetchNotifications = async () => {
        try {
            // Only fetch for sellers for now as per request
            if (!isSeller) return;

            const response = await sellerApi.getNotifications();
            if (response.data.success) {
                setNotifications(response.data.result.notifications);
                setUnreadCount(response.data.result.unreadCount);
            }
        } catch (error) {
            console.error("Notif Fetch Error:", error);
        }
    };

    React.useEffect(() => {
        fetchNotifications();
        // Polling every 30 seconds
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, [isSeller]);

    // Handle Click Outside
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMarkAsRead = async (id) => {
        try {
            await sellerApi.markNotificationRead(id);
            fetchNotifications();
        } catch (error) {
            toast.error("Failed to mark as read");
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await sellerApi.markAllNotificationsRead();
            fetchNotifications();
            toast.success("All caught up!");
        } catch (error) {
            toast.error("Failed to mark all as read");
        }
    };

    const handleLogout = () => {
        logout();
    };

    return (
        <header className={cn(
            "bg-white/70 backdrop-blur-xl border-b border-gray-100/50 flex items-center justify-between shadow-[0_4px_30px_rgba(0,0,0,0.02)] transition-all duration-300",
            (role === 'admin' || role === 'seller')
                ? "fixed top-0 left-0 right-0 z-50 h-14 px-4 md:static md:h-16 md:px-6"
                : "fixed top-0 left-56 right-0 h-16 px-6 z-40"
        )}>
            <div className="flex items-center flex-1 mr-4 overflow-hidden">
                <button
                    onClick={onMenuClick}
                    className={cn(
                        "p-2.5 mr-2 bg-gray-100/80 hover:bg-white rounded-xl text-gray-600 transition-all duration-300 md:hidden border border-transparent shadow-sm",
                        isSeller ? "hover:text-red-500 hover:border-red-500/20" : "hover:text-primary hover:border-primary/20"
                    )}
                >
                    <HiOutlineMenu className="h-5 w-5" />
                </button>

                <form onSubmit={handleSearchSubmit} className="relative w-full md:w-[400px] group">
                    <HiOutlineSearch className={cn("absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 transition-all duration-300", isSeller ? "group-focus-within:text-red-500" : "group-focus-within:text-primary")} />
                    <input
                        type="text"
                        placeholder={isSeller ? "Search products by name or SKU..." : "Search anything..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                        className={cn("w-full pl-10 pr-4 py-2 bg-gray-100/50 border border-transparent rounded-xl text-xs font-medium focus:bg-white transition-all duration-500 outline-none", isSeller ? "focus:ring-2 focus:ring-red-500/10 focus:border-red-500/20" : "focus:ring-2 focus:ring-primary/10 focus:border-primary/20")}
                    />
                </form>
            </div>

            <div className="flex items-center">
                <div className="relative" ref={notificationRef}>
                    <button
                        onClick={() => setShowNotifications(!showNotifications)}
                        className={cn(
                            "p-2 text-gray-500 rounded-xl transition-all duration-300 relative group",
                            isSeller ? "hover:bg-red-500/5 hover:text-red-500" : "hover:bg-primary/5 hover:text-primary",
                            showNotifications && (isSeller ? "bg-red-500/5 text-red-500" : "bg-primary/5 text-primary")
                        )}
                    >
                        <HiOutlineBell className="h-5 w-5" />
                        {unreadCount > 0 && (
                            <span className="absolute top-2 right-2 h-2 w-2 bg-rose-500 rounded-full ring-2 ring-white shadow-sm"></span>
                        )}
                    </button>

                    <AnimatePresence>
                        {showNotifications && (
                            <NotificationPopup
                                notifications={notifications}
                                onMarkAsRead={handleMarkAsRead}
                                onMarkAllAsRead={handleMarkAllAsRead}
                                onClose={() => setShowNotifications(false)}
                                isSeller={isSeller}
                            />
                        )}
                    </AnimatePresence>
                </div>

                <div className="h-8 w-px bg-gray-100 mx-1"></div>
                <button
                    onClick={() => {
                        if (location.pathname.startsWith('/admin')) {
                            navigate('/admin/profile');
                        } else if (location.pathname.startsWith('/seller')) {
                            navigate('/seller/profile');
                        } else if (location.pathname.startsWith('/delivery')) {
                            navigate('/delivery/profile');
                        } else {
                            navigate('/profile');
                        }
                    }}
                // className="flex items-center space-x-2.5 p-1 pr-3 hover:bg-gray-50 rounded-xl transition-all duration-300 group ring-1 ring-transparent hover:ring-gray-100 shadow-sm hover:shadow-md"
                >
                    <div className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-lg group-hover:scale-105 transition-transform",
                        isSeller
                            ? "bg-gradient-to-br from-red-500 to-rose-500 shadow-red-500/20"
                            : "bg-gradient-to-br from-primary to-indigo-600 shadow-primary/20"
                    )}>
                        {user?.name?.[0]?.toUpperCase() || 'A'}
                    </div>
                </button>
                <button
                    onClick={handleLogout}
                    className="hidden md:flex items-center space-x-1.5 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all duration-300 font-bold text-xs shadow-sm hover:shadow-rose-100/50"
                >
                    <HiOutlineLogout className="h-4 w-4" />
                    <span className="hidden lg:block">Sign Out</span>
                </button>
            </div>
        </header>
    );
};

export default Topbar;

