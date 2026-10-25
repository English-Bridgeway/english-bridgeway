import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AdminProvider, useAdmin } from "./AdminContext";
import { AdminLayout } from "./components/AdminLayout";
import { Loading } from "./ui";
import AdminLogin from "./pages/Login";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const ContentList = lazy(() => import("./pages/ContentList"));
const ContentEdit = lazy(() => import("./pages/ContentEdit"));
const Orders = lazy(() => import("./pages/Orders"));
const Messages = lazy(() => import("./pages/Messages"));
const SiteSettingsPage = lazy(() => import("./pages/SiteSettings"));
const PaymentSettingsPage = lazy(() => import("./pages/PaymentSettings"));
const Admins = lazy(() => import("./pages/Admins"));
const Activity = lazy(() => import("./pages/Activity"));
const Account = lazy(() => import("./pages/Account"));
const Learners = lazy(() => import("./pages/Learners"));
const LearnerDetail = lazy(() => import("./pages/LearnerDetail"));
const AiTutor = lazy(() => import("./pages/AiTutor"));
const Plans = lazy(() => import("./pages/Plans"));
const Policies = lazy(() => import("./pages/Policies"));
const Ebooks = lazy(() => import("./pages/Ebooks"));
const MobileApp = lazy(() => import("./pages/MobileApp"));

function Gate() {
  const { admin, isOwner } = useAdmin();
  if (!admin) return <AdminLogin />;
  return (
    <AdminLayout>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="content/:collection" element={<ContentList />} />
          <Route path="content/:collection/new" element={<ContentEdit />} />
          <Route path="content/:collection/edit/:key" element={<ContentEdit />} />
          <Route path="ebooks" element={<Ebooks />} />
          <Route path="orders" element={<Orders />} />
          <Route path="messages" element={<Messages />} />
          <Route path="learners" element={<Learners />} />
          <Route path="learners/:id" element={<LearnerDetail />} />
          <Route path="settings/ai" element={isOwner ? <AiTutor /> : <Navigate to="/admin" replace />} />
          <Route path="settings/site" element={<SiteSettingsPage />} />
          <Route path="settings/payments" element={isOwner ? <PaymentSettingsPage /> : <Navigate to="/admin" replace />} />
          <Route path="settings/plans" element={isOwner ? <Plans /> : <Navigate to="/admin" replace />} />
          <Route path="settings/app" element={isOwner ? <MobileApp /> : <Navigate to="/admin" replace />} />
          <Route path="settings/policies" element={isOwner ? <Policies /> : <Navigate to="/admin" replace />} />
          <Route path="admins" element={isOwner ? <Admins /> : <Navigate to="/admin" replace />} />
          <Route path="activity" element={<Activity />} />
          <Route path="account" element={<Account />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </Suspense>
    </AdminLayout>
  );
}

/** The admin panel at /admin: manages all site content, orders, payments and settings. */
export default function AdminApp() {
  return (
    <AdminProvider>
      <Gate />
    </AdminProvider>
  );
}
