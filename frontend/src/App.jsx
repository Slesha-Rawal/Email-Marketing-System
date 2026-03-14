import "./index.css";
import Login from "./pages/Login.jsx";
import Contact from "./pages/Contact.jsx";
import AddContact from "./pages/AddContact.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import Templates from "./pages/Templates.jsx";
import TemplateBuilder from "./pages/TemplateBuilder.jsx";
import Campaigns from "./pages/Campaigns.jsx";
import CreateCampaign from "./pages/CreateCampaign.jsx";
import Analytics from "./pages/Analytics.jsx";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

function PublicOnlyRoute({ children }) {
  const { isAuthenticated, isBootstrapping, user } = useAuth();

  if (isBootstrapping) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  if (isAuthenticated) {
    return (
      <Navigate
        to={user?.role === "admin" ? "/analytics" : "/contact"}
        replace
      />
    );
  }

  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <PublicOnlyRoute>
                <Login />
              </PublicOnlyRoute>
            }
          />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/contact" element={<Contact />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/analytics" element={<Analytics />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={["marketing"]} />}>
            <Route path="/add-contact" element={<AddContact />} />
            <Route path="/template-builder" element={<TemplateBuilder />} />
            <Route path="/create-campaign" element={<CreateCampaign />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
