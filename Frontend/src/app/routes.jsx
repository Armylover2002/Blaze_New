import { Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom'
import { Suspense, lazy, useEffect } from 'react'
import {
  AppShellSkeleton,
  AuthPortalSkeleton,
  ContentPageSkeleton,
} from '@food/components/ui/loading-skeletons'

import ProtectedRoute from '@core/guards/ProtectedRoute'
import FoodProtectedRoute from '../modules/Food/components/ProtectedRoute'
import RoleGuard from '@core/guards/RoleGuard'
import { AuthPageGuard } from '@core/guards/RouteGuard'
import { UserRole } from '@core/constants/roles'
import SellerAuthPage from '../modules/seller/pages/Auth'

const NATIVE_LAST_ROUTE_KEY = 'native_last_route'

// Lazy load the Food service module (Quick-spicy app)
const FoodApp = lazy(() => import('../modules/Food/routes'))
const AuthApp = lazy(() => import('../modules/auth/routes'))
const QuickCommerceApp = lazy(() => import('../modules/quickCommerce/routes'))
const PorterApp = lazy(() => import('../modules/porter/routes'))
const SellerApp = lazy(() => import('../modules/seller/routes'))


const FoodUserLayout = lazy(() => import('../modules/Food/components/user/UserLayout'))
const FoodHomePage = lazy(() => import('../modules/Food/pages/user/Home'))
const GlobalCartPage = lazy(() => import('../modules/Food/pages/user/cart/Cart'))
const GlobalSelectAddressPage = lazy(() => import('../modules/Food/pages/user/cart/SelectAddress'))
const GlobalAddressSelectorPage = lazy(() => import('../modules/Food/pages/user/cart/AddressSelectorPage'))
const SharedProfilePage = lazy(() => import('../modules/Food/pages/user/profile/Profile'))
const SharedProfileEditPage = lazy(() => import('../modules/Food/pages/user/profile/EditProfile'))
const SharedProfileSupportPage = lazy(() => import('../modules/Food/pages/user/profile/Support'))
const SharedProfileCouponsPage = lazy(() => import('../modules/Food/pages/user/profile/Coupons'))
const SharedProfileAboutPage = lazy(() => import('../modules/Food/pages/user/profile/About'))
const SharedProfileTermsPage = lazy(() => import('../modules/Food/pages/user/profile/Terms'))
const SharedProfilePrivacyPage = lazy(() => import('../modules/Food/pages/user/profile/Privacy'))
const SharedProfileRefundPage = lazy(() => import('../modules/Food/pages/user/profile/Refund'))
const SharedProfileShippingPage = lazy(() => import('../modules/Food/pages/user/profile/Shipping'))
const SharedProfileCancellationPage = lazy(() => import('../modules/Food/pages/user/profile/Cancellation'))

const RouteAwarePageLoader = () => {
  const location = useLocation()
  const pathname = location.pathname || ''

  if (pathname.startsWith('/user/auth')) {
    return <AuthPortalSkeleton />
  }



  if (pathname.startsWith('/admin')) {
    return <ContentPageSkeleton hero={false} />
  }

  return <AppShellSkeleton />
}
/**
 * FoodAppWrapper — Quick-spicy App. को /food prefix के साथ render करता है.
 * 
 * Quick-spicy की App.jsx में routes /restaurant, /usermain, /admin, /delivery
 * जैसे hain (bina /food prefix ke). Yahan hum useLocation se /food ke baad wala
 * path nikalne ke baad FoodApp render karte hain. FoodApp internally BrowserRouter
 * nahi use karta (sirf Routes use karta hai), isliye ye directly kaam karta hai.
 */
const FoodAppWrapper = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <FoodApp />
    </Suspense>
  )
}

const SharedFoodHomeRoute = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <FoodUserLayout>
        <FoodHomePage />
      </FoodUserLayout>
    </Suspense>
  )
}

const RedirectToFood = () => {
  const location = useLocation();
  // We safely replace the exact current pathname with a /food prefixed pathname
  // This effectively catches programmatic navigation to absolute paths like '/restaurant/login'
  // and turns them into '/food/restaurant/login'
  return <Navigate to={`/food${location.pathname}${location.search}`} replace />;
};

const RedirectLegacyQuickCommerce = () => {
  const location = useLocation();
  const suffix = location.pathname
    .replace(/^\/quick-commerce(?:\/user)?/, '');
  const normalizedSuffix = suffix && suffix !== '/' ? suffix : '';
  return (
    <Navigate
      to={`/quick${normalizedSuffix}${location.search}`}
      replace
    />
  );
};

const SellerAuthEntry = () => {
  return <SellerAuthPage />
}

const SellerAppWrapper = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <ProtectedRoute>
        <RoleGuard allowedRoles={[UserRole.SELLER]}>
          <SellerApp />
        </RoleGuard>
      </ProtectedRoute>
    </Suspense>
  )
}

const AdminRouter = lazy(() => import('../modules/Food/components/admin/AdminRouter'))

const AppRoutes = () => {
  const location = useLocation()

  useEffect(() => {
    // Eagerly prefetch the quick commerce routes and user app routes chunk after initial mount
    const prefetchTimeout = setTimeout(() => {
      import('../modules/quickCommerce/routes').catch(() => {});
      import('../modules/Food/routes').catch(() => {});
    }, 2000);

    return () => clearTimeout(prefetchTimeout);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return

    const protocol = String(window.location?.protocol || '').toLowerCase()
    const userAgent = String(window.navigator?.userAgent || '').toLowerCase()
    const isNativeLikeShell =
      Boolean(window.flutter_inappwebview) ||
      Boolean(window.ReactNativeWebView) ||
      protocol === 'file:' ||
      userAgent.includes(' wv') ||
      userAgent.includes('; wv')

    if (!isNativeLikeShell) return

    const route = `${location.pathname || ''}${location.search || ''}`
    if (route.startsWith('/food/') || route.startsWith('/admin')) {
      localStorage.setItem(NATIVE_LAST_ROUTE_KEY, route)
    }
  }, [location.pathname, location.search])

  return (
    <Routes>
        {/* Root now lands on the food user home page */}
        <Route path="/" element={<Navigate to={`/food/user${location.search}`} replace />} />

        {/* Auth Module */}
        <Route
          path="/user/auth/*"
          element={
            <AuthPageGuard module="user" home="/food/user">
              <AuthApp />
            </AuthPageGuard>
          }
        />
        <Route path="/portal" element={<Navigate to={`/food/user${location.search}`} replace />} />
        <Route path="/login" element={<Navigate to={`/user/auth/login${location.search}`} replace />} />

        {/* Food Module */}
        <Route path="/food/*" element={<FoodAppWrapper />} />

        {/* Public Customer Storefront Layout (Some routes inside are protected) */}
        <Route
          element={
            <Outlet />
          }
        >
          {/* Shared home entry so /food/user <-> /quick doesn't remount through different app trees */}
          <Route path="/food/user" element={<SharedFoodHomeRoute />} />

          {/* Quick storefront landing keeps the shared food layout */}
          <Route path="/quick" element={<SharedFoodHomeRoute />} />

          {/* Porter landing keeps the shared food layout (embedded Porter home via tab) */}
          <Route path="/porter" element={<SharedFoodHomeRoute />} />

          {/* Global shared cart */}
          <Route
            element={
              <Suspense fallback={<PageLoader />}>
                <FoodUserLayout />
              </Suspense>
            }
          >
            <Route path="/cart" element={<GlobalCartPage />} />
            <Route path="/cart/checkout" element={<Navigate to="/cart" replace />} />
            <Route path="/cart/select-address" element={<ProtectedRoute requiredRole="user" loginPath="/user/auth/login"><GlobalSelectAddressPage /></ProtectedRoute>} />
            <Route path="/cart/address-selector" element={<ProtectedRoute requiredRole="user" loginPath="/user/auth/login"><GlobalAddressSelectorPage /></ProtectedRoute>} />
            <Route path="/profile" element={<FoodProtectedRoute requiredRole="user" loginPath="/user/auth/login"><SharedProfilePage /></FoodProtectedRoute>} />
            <Route path="/profile/edit" element={<FoodProtectedRoute requiredRole="user" loginPath="/user/auth/login"><SharedProfileEditPage /></FoodProtectedRoute>} />
            <Route path="/profile/support" element={<FoodProtectedRoute requiredRole="user" loginPath="/user/auth/login"><SharedProfileSupportPage /></FoodProtectedRoute>} />
            <Route path="/profile/coupons" element={<FoodProtectedRoute requiredRole="user" loginPath="/user/auth/login"><SharedProfileCouponsPage /></FoodProtectedRoute>} />
            <Route path="/profile/about" element={<SharedProfileAboutPage />} />
            <Route path="/profile/terms" element={<SharedProfileTermsPage />} />
            <Route path="/profile/privacy" element={<SharedProfilePrivacyPage />} />
            <Route path="/profile/refund" element={<SharedProfileRefundPage />} />
            <Route path="/profile/shipping" element={<SharedProfileShippingPage />} />
            <Route path="/profile/cancellation" element={<SharedProfileCancellationPage />} />
          </Route>

          {/* Quick storefront */}
          <Route
            path="/quick/*"
            element={
              <Suspense fallback={<PageLoader />}>
                <QuickCommerceApp />
              </Suspense>
            }
          />
          <Route path="/quick-commerce/*" element={<RedirectLegacyQuickCommerce />} />
          <Route path="/qc/*" element={<Navigate to="/quick" replace />} />

          {/* Porter storefront (parcel delivery booking flow) */}
          <Route
            path="/porter/*"
            element={
              <Suspense fallback={<PageLoader />}>
                <PorterApp />
              </Suspense>
            }
          />

          {/* Dynamic intercept redirects for bare paths (accessed programmatically) */}
          <Route path="/user/*" element={<RedirectToFood />} />
          <Route path="/restaurant/*" element={<RedirectToFood />} />
          <Route path="/delivery/*" element={<RedirectToFood />} />
          <Route path="/usermain/*" element={<RedirectToFood />} />
          <Route path="/orders/*" element={<RedirectToFood />} />
        </Route>

        {/* Seller Module */}
        <Route path="/seller" element={<SellerAppWrapper />} />
        {/* Seller auth — redirect to /seller if already logged in */}
        <Route
          path="/seller/auth"
          element={
            <AuthPageGuard module="seller" home="/seller">
              <SellerAuthEntry />
            </AuthPageGuard>
          }
        />
        <Route path="/seller/*" element={<SellerAppWrapper />} />

        {/* Global Admin Portal - wrap lazy router in Suspense to avoid blank/crash on direct admin URLs */}
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<PageLoader />}>
              <AdminRouter />
            </Suspense>
          }
        />
        
        {/* Fallback 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
  )
}

const PageLoader = () => <RouteAwarePageLoader />

export default AppRoutes
