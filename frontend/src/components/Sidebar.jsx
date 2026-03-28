import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Users,
  Mail,
  FileText,
  BarChart3,
  Settings,
  House,
  User,
  LogOut,
  Send,
  History,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    { name: "Overview", path: "/", Icon: House },
    { name: "Contacts", path: "/contact", Icon: Users },
    { name: "Templates", path: "/templates", Icon: FileText },
    { name: "Campaigns", path: "/campaigns", Icon: Mail },
    { name: "Send Emails", path: "/send-emails", Icon: Send },
    { name: "Email Logs", path: "/email-logs", Icon: History },
    { name: "Analytics", path: "/analytics", Icon: BarChart3 },
    ...(user?.role === "admin"
      ? [{ name: "Users", path: "/users", Icon: User }]
      : []),
    { name: "Settings", path: "/settings", Icon: Settings },
  ];

  return (
    <aside className="w-64 bg-[#272739] h-screen fixed left-0 top-0 shadow-xl">
      <div className="p-6">
        <div className="mb-8 px-4">
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
              <Mail className="text-white w-5 h-5" />
            </div>
            HSA Mail
          </h1>
        </div>
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.Icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  active
                    ? "text-white bg-indigo-600 shadow-lg shadow-indigo-900/40"
                    : "text-indigo-100/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon
                  className={`w-4.5 h-4.5 ${active ? "text-white" : "text-indigo-100/50 group-hover:text-white"}`}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="absolute bottom-6 left-6 right-6 pt-6 border-t border-white/5">
        <div className="flex items-center justify-between gap-3 px-2 group/user">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="shrink-0 w-9 h-9 bg-indigo-500/20 rounded-full flex items-center justify-center border border-indigo-500/20">
              <User className="text-indigo-300 w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-white truncate">
                {user?.name || "User"}
              </p>
              <p className="text-[10px] text-indigo-300/60 uppercase font-bold tracking-wider truncate">
                {user?.role || "Subscriber"}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            title="Logout"
            className="p-2 text-indigo-100/40 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
