import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Users, Mail, FileText, BarChart3 } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

function Sidebar() {
  const location = useLocation();
  const { user } = useAuth();

  const navItems = [
    { name: "Contacts", path: "/contact", Icon: Users },
    { name: "Campaigns", path: "/campaigns", Icon: Mail },
    { name: "Templates", path: "/templates", Icon: FileText },
    { name: "Analytics", path: "/analytics", Icon: BarChart3 },
  ];

  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0">
      <div className="p-6">
        <div className="mb-6 rounded-xl bg-gray-50 p-4 border border-gray-200">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
            Signed in as
          </div>
          <div className="font-semibold text-gray-900">{user?.name}</div>
          <div className="text-sm text-gray-600">{user?.role}</div>
          <p className="mt-3 text-xs text-gray-500">
            {user?.role === "admin"
              ? "Admin access is view-only for contacts, templates, campaigns, and analytics."
              : "Marketing users can manage contacts, templates, and campaigns."}
          </p>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.Icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "text-indigo-700 bg-indigo-50"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${active ? "text-indigo-700" : "text-gray-500"}`}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

export default Sidebar;
