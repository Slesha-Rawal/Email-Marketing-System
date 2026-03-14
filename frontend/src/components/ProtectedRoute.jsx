import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

function ProtectedRoute({ allowedRoles }) {
  const { isAuthenticated, isBootstrapping, user } = useAuth();

  if (isBootstrapping) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return (
      <Navigate
        to={user?.role === "admin" ? "/analytics" : "/contact"}
        replace
      />
    );
  }

  return <Outlet />;
}

export default ProtectedRoute;
