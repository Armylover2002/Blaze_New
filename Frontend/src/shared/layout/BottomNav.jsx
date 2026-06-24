import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    ClipboardList,
    Box,
    Wallet,
    MoreHorizontal,
    ChevronDown,
    X
} from 'lucide-react';

import { useAuth } from '@/core/context/AuthContext';

const BottomNav = ({ navItems }) => {
    const { role } = useAuth();
    const location = useLocation();

    const isSellerPanel = location.pathname.startsWith('/seller');

    // Define the primary bottom nav items based on user role
    const primaryItems = role === 'admin' ? [
        { label: 'Dashboard', path: '/admin', icon: LayoutDashboard, end: true },
        { label: 'Orders', path: '/admin/orders/all', icon: ClipboardList },
        { label: 'Products', path: '/admin/products', icon: Box },
        { label: 'Wallet', path: '/admin/wallet', icon: Wallet },
    ] : [
        { label: 'Dashboard', path: '/seller', icon: LayoutDashboard, end: true },
        { label: 'Orders', path: '/seller/orders', icon: ClipboardList },
        { label: 'Products', path: '/seller/products', icon: Box },
        { label: 'Earnings', path: '/seller/earnings', icon: Wallet },
    ];

    return (
        <div className={cn(
            "fixed bottom-0 left-0 right-0 h-16 border-t z-[60] md:hidden px-2 flex items-center justify-around",
            isSellerPanel
                ? "bg-[#EDE8E0] border-slate-200 shadow-[0_-10px_30px_rgba(0,0,0,0.06)]"
                : "bg-[#0a0c10] border-white/5 shadow-[0_-10px_30px_rgba(0,0,0,0.4)]"
        )}>
            {primaryItems.map((item) => (
                <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.end}
                    className={({ isActive }) => cn(
                        "flex flex-col items-center justify-center space-y-1 w-16 transition-all duration-300",
                        isActive
                            ? (isSellerPanel ? "text-red-500 font-bold" : "text-primary font-bold")
                            : (isSellerPanel ? "text-[#5C5247] hover:text-[#1A1A1A]" : "text-gray-500 hover:text-gray-300")
                    )}
                >
                    <item.icon className="h-5 w-5" />
                    <span className="text-[10px] font-bold uppercase tracking-tight">{item.label}</span>
                </NavLink>
            ))}
        </div>
    );
};

export default BottomNav;

