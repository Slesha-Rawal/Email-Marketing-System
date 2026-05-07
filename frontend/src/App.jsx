import "./index.css";
import Login from "./pages/Login.jsx";
import Contact from "./pages/Contact.jsx";
import AddContact from "./pages/AddContact.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import Templates from "./pages/Templates.jsx";
import EmailLogs from "./pages/EmailLogs.jsx";
import TemplatePreview from "./pages/TemplatePreview.jsx";
import TemplateBuilder from "./pages/TemplateBuilder.jsx";
import Campaigns from "./pages/Campaigns.jsx";
import SendEmails from "./pages/SendEmails.jsx";
import SendCampaign from "./pages/SendCampaign.jsx";
import SendCampaignDetails from "./pages/SendCampaignDetails.jsx";
import CreateCampaign from "./pages/CreateCampaign.jsx";
import Analytics from "./pages/Analytics.jsx";
import AnalyticsRecipientsActivity from "./pages/AnalyticsRecipientsActivity.jsx";
import Settings from "./pages/Settings.jsx";
import Profile from "./pages/Profile.jsx";
import Overview from "./pages/Overview.jsx";
import UsersPage from "./pages/Users.jsx";
import UserActivityPage from "./pages/UserActivity.jsx";
import UnsubscribeFeedback from "./pages/UnsubscribeFeedback.jsx";
import UnsubscribeFeedbackInsights from "./pages/UnsubscribeFeedbackInsights.jsx";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { useEffect } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

function PublicOnlyRoute({ children }) {
  const { isAuthenticated, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  return null;
}

function AnimatedRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Overview />} />
        <Route path="/overview" element={<Navigate to="/" replace />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/templates/:id/preview" element={<TemplatePreview />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route
          path="/analytics/campaigns/:campaignId/recipients"
          element={<AnalyticsRecipientsActivity />}
        />
        <Route
          path="/campaign-analytics"
          element={<Navigate to="/analytics" replace />}
        />
        <Route path="/email-logs" element={<EmailLogs />} />
        <Route
          path="/analytics/unsubscribe-feedback/insights"
          element={<UnsubscribeFeedbackInsights />}
        />
        <Route path="/profile" element={<Profile />} />
        <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
          <Route path="/users" element={<UsersPage />} />
          <Route
            path="/users/:userId/activity"
            element={<UserActivityPage />}
          />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={["users", "admin"]} />}>
          <Route path="/add-contact" element={<AddContact />} />
          <Route path="/template-builder" element={<TemplateBuilder />} />
          <Route
            path="/template-builder/:templateId"
            element={<TemplateBuilder />}
          />
          <Route path="/create-campaign" element={<CreateCampaign />} />
          <Route
            path="/create-campaign/:campaignId"
            element={<CreateCampaign />}
          />
          <Route path="/send-emails" element={<SendEmails />} />
          <Route path="/send-campaign" element={<SendCampaign />} />
          <Route
            path="/send-campaign/:campaignId"
            element={<SendCampaignDetails />}
          />
        </Route>
      </Route>
      <Route path="/unsubscribe" element={<UnsubscribeFeedback />} />
      <Route
        path="/unsubscribe-feedback"
        element={<UnsubscribeFeedback />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <AnimatedRoutes />
        <ToastContainer
          position="top-right"
          autoClose={2500}
          newestOnTop
          closeOnClick
          pauseOnHover
          theme="light"
        />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
