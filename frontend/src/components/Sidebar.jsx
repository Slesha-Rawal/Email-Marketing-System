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
  Megaphone,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();

  const isActivePath = (itemPath) => {
    if (itemPath === "/") {
      return location.pathname === "/";
    }

    if (itemPath === "/contact") {
      return (
        location.pathname === "/contact" ||
        location.pathname.startsWith("/contact/") ||
        location.pathname === "/add-contact"
      );
    }

    if (itemPath === "/templates") {
      return (
        location.pathname === "/templates" ||
        location.pathname.startsWith("/templates/") ||
        location.pathname === "/template-builder" ||
        location.pathname.startsWith("/template-builder/")
      );
    }

    if (itemPath === "/campaigns") {
      return (
        location.pathname === "/campaigns" ||
        location.pathname.startsWith("/campaigns/") ||
        location.pathname === "/create-campaign" ||
        location.pathname.startsWith("/create-campaign/")
      );
    }

    if (itemPath === "/settings") {
      return location.pathname === "/settings";
    }

    if (itemPath === "/profile") {
      return location.pathname === "/profile";
    }

    return (
      location.pathname === itemPath ||
      location.pathname.startsWith(`${itemPath}/`)
    );
  };

  const navSections = [
    {
      title: "Main",
      items: [
        { name: "Overview", path: "/", Icon: House },
        { name: "Contacts", path: "/contact", Icon: Users },
        { name: "Templates", path: "/templates", Icon: FileText },
        { name: "Campaigns", path: "/campaigns", Icon: Mail },
        {
          name: "Send Email",
          path: "/send-emails",
          Icon: Send,
          subsectionLabel: "Email Sender",
        },
        {
          name: "Send Campaign",
          path: "/send-campaign",
          Icon: Megaphone,
          subsectionLabel: "Email Sender",
        },
        { name: "Email Logs", path: "/email-logs", Icon: History },
        { name: "Analytics", path: "/analytics", Icon: BarChart3 },
      ],
    },
    {
      title: "Account",
      items: [
        { name: "My Profile", path: "/profile", Icon: User },
        ...(user?.role === "admin"
          ? [
              { name: "Users", path: "/users", Icon: User },
              { name: "Settings", path: "/settings", Icon: Settings },
            ]
          : []),
      ],
    },
  ];

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 bg-[#272739] border-r border-white/10">
      <div className="h-full flex flex-col">
        <div className="px-4 pt-4 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Mail className="text-white w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[16px] font-semibold text-white leading-tight truncate">
                HSA Mail
              </h1>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2.5 space-y-4 custom-scrollbar">
          {navSections.map((section) => {
            if (!section.items.length) {
              return null;
            }

            return (
              <section key={section.title} className="space-y-1">
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-200/45">
                  {section.title}
                </p>

                {section.items.map((item, idx) => {
                  const Icon = item.Icon;
                  const active = isActivePath(item.path);
                  const showLabel =
                    item.subsectionLabel &&
                    (idx === 0 ||
                      section.items[idx - 1].subsectionLabel !==
                        item.subsectionLabel);

                  return (
                    <div key={item.path}>
                      {showLabel && (
                        <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-200/45">
                          {item.subsectionLabel}
                        </p>
                      )}
                      <Link
                        to={item.path}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                          active
                            ? "text-white bg-indigo-600"
                            : "text-indigo-100/75 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 ${active ? "text-white" : "text-indigo-100/55"}`}
                        />
                        <span className="truncate">{item.name}</span>
                      </Link>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-white/10">
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-red-400 hover:bg-white/10 hover:text-red-300 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
