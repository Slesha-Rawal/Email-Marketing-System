import React, { useEffect, useRef, useState } from "react";
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
  MoreVertical,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { isAdmin, hasRole } from "../lib/rbac.js";
import api from "../lib/api.js";
import defaultAvatar from "../assets/default-avatar.svg";

function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const canManageUserFeatures = hasRole(user, ["users", "admin"]);
  const canManageAdminFeatures = isAdmin(user);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  const resolveAvatarUrl = (value) => {
    const source = String(value || "").trim();

    if (!source) {
      return "";
    }

    if (source.startsWith("http://") || source.startsWith("https://")) {
      return source;
    }

    const baseUrl = String(api.defaults.baseURL || "").trim();
    const origin = baseUrl.replace(/\/api\/?$/, "");
    const normalizedPath = source.startsWith("/") ? source : `/${source}`;
    return `${origin}${normalizedPath}`;
  };

  const userAvatarUrl = resolveAvatarUrl(user?.avatarUrl);

  useEffect(() => {
    setIsProfileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const isActivePath = (itemPath) => {
    const isUnsubscribeInsightsRoute =
      location.pathname === "/analytics/unsubscribe-feedback/insights";

    if (itemPath === "/") {
      return location.pathname === "/" || isUnsubscribeInsightsRoute;
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

    if (itemPath === "/analytics") {
      return (
        (location.pathname === itemPath ||
          location.pathname.startsWith(`${itemPath}/`)) &&
        !isUnsubscribeInsightsRoute
      );
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
        ...(canManageUserFeatures
          ? [
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
            ]
          : []),
        { name: "Email Logs", path: "/email-logs", Icon: History },
        { name: "Analytics", path: "/analytics", Icon: BarChart3 },
      ],
    },
    {
      title: "Account",
      items: [
        { name: "My Profile", path: "/profile", Icon: User },
        ...(canManageAdminFeatures
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
        <div className="px-4 pt-4 pb-3">
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
                        <p className="px-2 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-200/45">
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

        <div className="px-3 pb-3 border-t border-white/10 pt-3">
          <div className="flex items-center gap-2.5 rounded-lg bg-white/10 px-2.5 py-2">
            <div className="h-9 w-9 overflow-hidden rounded-full bg-white/15 flex items-center justify-center text-xs font-semibold text-white">
              {userAvatarUrl ? (
                <img
                  src={userAvatarUrl}
                  alt="User avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <img
                  src={defaultAvatar}
                  alt="Default avatar"
                  className="h-full w-full object-cover"
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white">
                {user?.name || "User"}
              </p>
              <p className="truncate text-[12px] text-indigo-100/70">
                {user?.email || ""}
              </p>
            </div>

            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-indigo-100/70 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="More options"
                aria-expanded={isProfileMenuOpen}
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {isProfileMenuOpen ? (
                <div className="absolute right-0 bottom-9 z-20 w-36 rounded-lg border border-white/15 bg-[#1f1f2f] p-1.5 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium text-red-300 hover:bg-white/10 hover:text-red-200 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
