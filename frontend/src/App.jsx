import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import EmailSuccessPage from './pages/EmailSuccessPage';

import NewPOSPage from './pages/NewPOSPage';
import MobilePOSPage from './pages/MobilePOSPage';
import MobileProductsPage from './pages/MobileProductsPage';
import MobileCustomersPage from './pages/MobileCustomersPage';
import MobileSalesPage from './pages/MobileSalesPage';
import MobileInvoicesPage from './pages/MobileInvoicesPage';
import ProductsPage from './pages/ProductsPage';
import CustomersPage from './pages/CustomersPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
import SalesPage from './pages/SalesPage';
import InvoicesPage from './pages/InvoicesPage';
import ManualPurchaseInvoicePage from './pages/ManualPurchaseInvoicePage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/email-success" element={<EmailSuccessPage />} />


          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute permission="can_view_pos">
                <Layout>
                  <NewPOSPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/products"
            element={
              <ProtectedRoute permission="can_view_products">
                <Layout>
                  <ProductsPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <ProtectedRoute permission="can_view_customers">
                <Layout>
                  <CustomersPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer/:customerName"
            element={
              <ProtectedRoute permission="can_view_customers">
                <Layout>
                  <CustomerDetailPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/sales"
            element={
              <ProtectedRoute permission="can_view_sales">
                <Layout>
                  <SalesPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoices"
            element={
              <ProtectedRoute permission="can_view_invoices">
                <Layout>
                  <InvoicesPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/manual-purchase-invoice"
            element={
              <ProtectedRoute permission="can_view_invoices">
                <Layout>
                  <ManualPurchaseInvoicePage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute permission="can_view_users">
                <Layout>
                  <UsersPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute permission="can_view_users">
                <Layout>
                  <SettingsPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/mobile-pos"
            element={
              <ProtectedRoute permission="can_view_pos">
                <MobilePOSPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mobile-products"
            element={
              <ProtectedRoute permission="can_view_products">
                <MobileProductsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mobile-customers"
            element={
              <ProtectedRoute permission="can_view_customers">
                <MobileCustomersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mobile-sales"
            element={
              <ProtectedRoute permission="can_view_sales">
                <MobileSalesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mobile-invoices"
            element={
              <ProtectedRoute permission="can_view_invoices">
                <MobileInvoicesPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
