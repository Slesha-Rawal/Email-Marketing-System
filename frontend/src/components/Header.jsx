import React from "react";
import { Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

function Header() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-semibold text-gray-900 block">
              Email Portal
            </span>
            <span className="text-xs uppercase tracking-wide text-gray-500">
              {user?.role === "admin" ? "Admin monitor" : "Marketing workspace"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-semibold text-gray-800">
              {user?.name}
            </div>
            <div className="text-xs text-gray-500">
              {user?.email} · {user?.role}
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
