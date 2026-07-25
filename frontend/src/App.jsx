import { useState, lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Layouts
import CustomerLayout from './components/layout/CustomerLayout';
import AdminLayout from './components/layout/AdminLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';

// Cart drawer (global — persists across pages)
import CartDrawer from './components/ui/CartDrawer';
import Spinner from './components/ui/Spinner';

// Auth stores
import useAuthStore from './stores/authStore';
import useAdminAuthStore from './stores/adminAuthStore';
import useSocket from './hooks/useSocket';

// Guard: redirect already-logged-in customers away from /login and /signup
const AuthRedirect = ({ children }) => {
  const { user, token } = useAuthStore();
  if (token && user) {
    return <Navigate to="/" replace />;
  }
  return children;
};

// Guard: redirect already-logged-in admins away from /admin/login
const AdminAuthRedirect = ({ children }) => {
  const { user, token } = useAdminAuthStore();
  if (token && user) {
    return <Navigate to="/admin" replace />;
  }
  return children;
};

// Auth pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const SignupPage = lazy(() => import('./pages/auth/SignupPage'));
const AdminLoginPage = lazy(() => import('./pages/auth/AdminLoginPage'));

// Customer pages
const HomePage = lazy(() => import('./pages/customer/HomePage'));
const MenuPage = lazy(() => import('./pages/customer/MenuPage'));
const ProductDetailPage = lazy(() => import('./pages/customer/ProductDetailPage'));
const CartPage = lazy(() => import('./pages/customer/CartPage'));
const CheckoutPage = lazy(() => import('./pages/customer/CheckoutPage'));
const OrdersPage = lazy(() => import('./pages/customer/OrdersPage'));
const SpinPage = lazy(() => import('./pages/customer/SpinPage'));
const ProfilePage = lazy(() => import('./pages/customer/ProfilePage'));
const HotDealsPage = lazy(() => import('./pages/customer/HotDealsPage'));
const NotFoundPage = lazy(() => import('./pages/customer/NotFoundPage'));
const { PaymentSuccessPage, PaymentFailedPage } = { // lazy-compatible named exports
  PaymentSuccessPage: lazy(() =>
    import('./pages/customer/PaymentResultPage').then((m) => ({ default: m.PaymentSuccessPage }))
  ),
  PaymentFailedPage: lazy(() =>
    import('./pages/customer/PaymentResultPage').then((m) => ({ default: m.PaymentFailedPage }))
  ),
};

// Admin pages
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'));
const AdminOrdersPage = lazy(() => import('./pages/admin/OrdersPage'));
const AdminProductsPage = lazy(() => import('./pages/admin/ProductsPage'));
const AdminCategoriesPage = lazy(() => import('./pages/admin/CategoriesPage'));
const AdminReportsPage = lazy(() => import('./pages/admin/ReportsPage'));
const AdminAnalyticsPage = lazy(() => import('./pages/admin/AnalyticsPage'));
const AdminSpinPage = lazy(() => import('./pages/admin/SpinManagePage'));
const AdminDealsPage   = lazy(() => import('./pages/admin/DealsPage'));
const AdminCustomersPage = lazy(() => import('./pages/admin/CustomersPage'));
const AdminPromoCodesPage = lazy(() => import('./pages/admin/PromoCodesPage'));
const AdminProfilePage    = lazy(() => import('./pages/admin/ProfilePage'));
const AdminLuckyDrawPage  = lazy(() => import('./pages/admin/LuckyDrawPage'));

// Customer pages (lucky draw)
const LuckyDrawPage = lazy(() => import('./pages/customer/LuckyDrawPage'));

// CartDrawer context — lets Navbar open the cart from anywhere
import { createContext, useContext } from 'react';

export const CartDrawerContext = createContext({ open: false, setOpen: () => {} });
export const useCartDrawer = () => useContext(CartDrawerContext);

const App = () => {
  const [cartOpen, setCartOpen] = useState(false);
  const { token: customerToken, fetchMe: fetchCustomer } = useAuthStore();
  const { token: adminToken, fetchMe: fetchAdmin } = useAdminAuthStore();

  // Connect socket and join rooms
  useSocket();

  // On app load — silently validate stored tokens and refresh user data
  // This keeps the session alive across browser restarts without re-login
  useEffect(() => {
    // Only call fetchMe if that specific store has a token
    // This prevents admin token from accidentally refreshing customer store
    if (customerToken) fetchCustomer();
    if (adminToken)    fetchAdmin();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <CartDrawerContext.Provider value={{ open: cartOpen, setOpen: setCartOpen }}>
      <BrowserRouter>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3500,
            style: {
              borderRadius: '12px',
              fontSize: '14px',
              padding: '12px 16px',
              maxWidth: '380px',
            },
            success: { iconTheme: { primary: '#E85D04', secondary: '#fff' } },
          }}
        />

        {/* Global cart drawer */}
        <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />

        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Spinner size="lg" /></div>}>
          <Routes>
            {/* ── Customer-facing routes ── */}
            <Route element={<CustomerLayout onCartOpen={() => setCartOpen(true)} />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/menu" element={<MenuPage />} />
              <Route path="/product/:id" element={<ProductDetailPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/spin" element={<SpinPage />} />
              <Route path="/deals" element={<HotDealsPage />} />
              <Route path="/lucky-draw" element={<LuckyDrawPage />} />

              {/* Auth-required customer routes */}
              <Route
                path="/checkout"
                element={
                  <ProtectedRoute>
                    <CheckoutPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders"
                element={
                  <ProtectedRoute>
                    <OrdersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders/:id"
                element={
                  <ProtectedRoute>
                    <OrdersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />

              {/* EasyPaisa callback redirect pages */}
              <Route path="/payment/success" element={<ProtectedRoute><PaymentSuccessPage /></ProtectedRoute>} />
              <Route path="/payment/failed"  element={<ProtectedRoute><PaymentFailedPage /></ProtectedRoute>} />
            </Route>

            {/* ── Auth pages (no layout) ── */}
            {/* Redirect already-logged-in users away from auth pages */}
            <Route path="/login" element={<AuthRedirect><LoginPage /></AuthRedirect>} />
            <Route path="/signup" element={<AuthRedirect><SignupPage /></AuthRedirect>} />
            <Route path="/admin/login" element={<AdminAuthRedirect><AdminLoginPage /></AdminAuthRedirect>} />

            {/* ── Admin panel routes ── */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute adminOnly>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="orders" element={<AdminOrdersPage />} />
              <Route path="products" element={<AdminProductsPage />} />
              <Route path="categories" element={<AdminCategoriesPage />} />
              <Route path="reports"   element={<AdminReportsPage />} />
              <Route path="analytics" element={<AdminAnalyticsPage />} />
              <Route path="spin"      element={<AdminSpinPage />} />
              <Route path="lucky-draw" element={<AdminLuckyDrawPage />} />
              <Route path="deals"     element={<AdminDealsPage />} />
              <Route path="customers" element={<AdminCustomersPage />} />
              <Route path="promos"    element={<AdminPromoCodesPage />} />
              <Route path="profile"   element={<AdminProfilePage />} />
            </Route>

            {/* Catch-all — proper 404 inside customer layout */}
            <Route element={<CustomerLayout onCartOpen={() => setCartOpen(true)} />}>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </CartDrawerContext.Provider>
  );
};

export default App;
