import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Users,
  Mail,
  FileText,
  BarChart3,
  Mail as MailIcon,
} from "lucide-react";

function Sidebar() {
  const location = useLocation();

  const navItems = [
    { name: "Contacts", path: "/contact", Icon: Users },
    { name: "Campaigns", path: "/campaigns", Icon: Mail },
    { name: "Templates", path: "/templates", Icon: FileText },
    { name: "Analytics", path: "/analytics", Icon: BarChart3 },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0">
      <div className="p-6">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.Icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium ${
                  location.pathname === item.path
                    ? "text-indigo-600 bg-indigo-50"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export default Sidebar;
