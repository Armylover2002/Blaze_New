import React, { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Loader from "@/modules/Food/components/Loader";

const Dashboard = React.lazy(() => import("../pages/Dashboard"));
const Vehicles = React.lazy(() => import("../pages/Vehicles"));


const PricingCommission = React.lazy(() => import("../pages/PricingCommission"));
const Coupons = React.lazy(() => import("../pages/Coupons"));
const Zones = React.lazy(() => import("../pages/Zones"));
const Orders = React.lazy(() => import("../pages/Orders"));
const Users = React.lazy(() => import("../pages/Users"));
const Wallet = React.lazy(() => import("../pages/Wallet"));
const Transactions = React.lazy(() => import("../pages/Transactions"));
const Reports = React.lazy(() => import("../pages/Reports"));
const Notifications = React.lazy(() => import("../pages/Notifications"));

const BannerManagement = React.lazy(() => import("../pages/BannerManagement"));


function PorterAdminRoutesInner() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin/porter/dashboard" replace />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/vehicles" element={<Vehicles />} />


      <Route path="/pricing" element={<PricingCommission />} />
      <Route path="/coupons" element={<Coupons />} />
      <Route path="/zones" element={<Zones />} />
      <Route path="/orders" element={<Orders />} />
      <Route path="/users" element={<Users />} />
      <Route path="/wallet" element={<Wallet />} />
      <Route path="/transactions" element={<Transactions />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/notifications" element={<Notifications />} />

      <Route path="/banners" element={<BannerManagement />} />

      <Route path="*" element={<Navigate to="/admin/porter/dashboard" replace />} />
    </Routes>
  );
}

export default function PorterAdminRoutes() {
  return (
    <Suspense fallback={<Loader />}>
      <PorterAdminRoutesInner />
    </Suspense>
  );
}
