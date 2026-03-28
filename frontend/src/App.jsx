import "./index.css";
import Login from "./pages/Login.jsx";
import Contact from "./pages/Contact.jsx";
import AddContact from "./pages/AddContact.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import Templates from "./pages/Templates.jsx";
import EmailLogs from "./pages/EmailLogs.jsx";
import TemplatePreview from "./pages/TemplatePreview.jsx";
import TemplateBuilder from "./pages/TemplateBuilder.jsx";
import Campaigns from "./pages/Campaigns.jsx";
import SendEmails from "./pages/SendEmails.jsx";
import CreateCampaign from "./pages/CreateCampaign.jsx";
import Analytics from "./pages/Analytics.jsx";
import Settings from "./pages/Settings.jsx";
import Overview from "./pages/Overview.jsx";
import UsersPage from "./pages/Users.jsx";
import UnsubscribeFeedback from "./pages/UnsubscribeFeedback.jsx";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
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

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Overview />} />
            <Route path="/overview" element={<Navigate to="/" replace />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/templates" element={<Templates />} />
            <Route
              path="/templates/:id/preview"
              element={<TemplatePreview />}
            />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/send-emails" element={<SendEmails />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/email-logs" element={<EmailLogs />} />
            <Route path="/settings" element={<Settings />} />
            <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
              <Route path="/users" element={<UsersPage />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={["marketing"]} />}>
              <Route path="/add-contact" element={<AddContact />} />
              <Route path="/template-builder" element={<TemplateBuilder />} />
              <Route path="/create-campaign" element={<CreateCampaign />} />
            </Route>
          </Route>
          <Route path="/unsubscribe" element={<UnsubscribeFeedback />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
