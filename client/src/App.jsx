import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';

import PublicLayout from './components/layout/PublicLayout.jsx';
import DashboardLayout from './components/layout/DashboardLayout.jsx';
import AdminLayout from './components/layout/AdminLayout.jsx';
import { RequireAdmin, RequireAuth, RedirectIfAuthenticated } from './components/layout/RouteGuards.jsx';
import { Spinner } from './components/ui/Feedback.jsx';

import Home from './pages/public/Home.jsx';
import HowItWorks from './pages/public/HowItWorks.jsx';
import Charities from './pages/public/Charities.jsx';
import CharityProfile from './pages/public/CharityProfile.jsx';
import Draws from './pages/public/Draws.jsx';
import Pricing from './pages/public/Pricing.jsx';
import Login from './pages/public/Login.jsx';
import Register from './pages/public/Register.jsx';
import NotFound from './pages/NotFound.jsx';

import DashboardOverview from './pages/dashboard/Overview.jsx';
import DashboardScores from './pages/dashboard/Scores.jsx';
import DashboardCharity from './pages/dashboard/Charity.jsx';
import DashboardSubscription from './pages/dashboard/Subscription.jsx';
import DashboardWinnings from './pages/dashboard/Winnings.jsx';
import DashboardProfile from './pages/dashboard/Profile.jsx';

// The admin bundle is only fetched once an administrator actually opens it.
const AdminOverview = lazy(() => import('./pages/admin/Overview.jsx'));
const AdminUsers = lazy(() => import('./pages/admin/Users.jsx'));
const AdminSubscriptions = lazy(() => import('./pages/admin/Subscriptions.jsx'));
const AdminScores = lazy(() => import('./pages/admin/Scores.jsx'));
const AdminDraws = lazy(() => import('./pages/admin/Draws.jsx'));
const AdminDrawDetail = lazy(() => import('./pages/admin/DrawDetail.jsx'));
const AdminCharities = lazy(() => import('./pages/admin/Charities.jsx'));
const AdminWinners = lazy(() => import('./pages/admin/Winners.jsx'));
const AdminReports = lazy(() => import('./pages/admin/Reports.jsx'));

function RouteFallback() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Spinner className="h-7 w-7" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Public */}
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="how-it-works" element={<HowItWorks />} />
          <Route path="charities" element={<Charities />} />
          <Route path="charities/:id" element={<CharityProfile />} />
          <Route path="draws" element={<Draws />} />
          <Route path="pricing" element={<Pricing />} />
          <Route
            path="login"
            element={
              <RedirectIfAuthenticated>
                <Login />
              </RedirectIfAuthenticated>
            }
          />
          <Route
            path="register"
            element={
              <RedirectIfAuthenticated>
                <Register />
              </RedirectIfAuthenticated>
            }
          />
        </Route>

        {/* Member */}
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardOverview />} />
            <Route path="scores" element={<DashboardScores />} />
            <Route path="charity" element={<DashboardCharity />} />
            <Route path="subscription" element={<DashboardSubscription />} />
            <Route path="winnings" element={<DashboardWinnings />} />
            <Route path="profile" element={<DashboardProfile />} />
          </Route>
        </Route>

        {/* Administrator */}
        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="subscriptions" element={<AdminSubscriptions />} />
            <Route path="scores" element={<AdminScores />} />
            <Route path="draws" element={<AdminDraws />} />
            <Route path="draws/:id" element={<AdminDrawDetail />} />
            <Route path="charities" element={<AdminCharities />} />
            <Route path="winners" element={<AdminWinners />} />
            <Route path="reports" element={<AdminReports />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
