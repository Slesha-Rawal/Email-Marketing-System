import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Mail,
  MessageSquareText,
  Users,
} from "lucide-react";
import { useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";
import Pagination from "../components/Pagination.jsx";
import api from "../lib/api.js";
import defaultAvatar from "../assets/default-avatar.svg";

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

const formatDateTime = (value) => {
  if (!value) {
    return "Never";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Never";
  }

  return parsed.toLocaleString();
};

const formatDateOnly = (value) => {
  if (!value) {
    return "Never";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Never";
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatRoleLabel = (role = "") =>
  role === "admin" ? "Admin" : role === "users" ? "User" : role;

const formatPercentage = (value, total) => {
  const safeTotal = Number(total || 0);

  if (safeTotal <= 0) {
    return "0.0%";
  }

  return `${((Number(value || 0) / safeTotal) * 100).toFixed(1)}%`;
};

const summaryCards = [
  {
    key: "lastActivityAt",
    label: "Last Activity",
    icon: Clock3,
    styleClass: "bg-sky-100 text-sky-700",
  },
  {
    key: "contactsCreated",
    label: "Contacts Created",
    icon: Users,
    styleClass: "bg-indigo-100 text-indigo-700",
  },
  {
    key: "templatesCreated",
    label: "Templates Created",
    icon: MessageSquareText,
    styleClass: "bg-pink-100 text-pink-700",
  },
  {
    key: "campaignsCreated",
    label: "Campaigns Created",
    icon: Mail,
    styleClass: "bg-purple-100 text-purple-700",
  },
  {
    key: "campaignsSent",
    label: "Campaigns Sent",
    icon: CheckCircle2,
    styleClass: "bg-[#E3F2E5] text-[#66B35D]",
  },
];

function UserActivityPage() {
  const { userId } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState({});
  const [sentCampaigns, setSentCampaigns] = useState([]);
  const campaignTableRef = useRef(null);

  useEffect(() => {
    const fetchUserActivity = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/admin/users/${userId}/activity`);
        setUser(response.data?.user || null);
        setSummary(response.data?.summary || {});
        setSentCampaigns(
          Array.isArray(response.data?.sentCampaigns)
            ? response.data.sentCampaigns
            : [],
        );
        setError("");
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Failed to load user activity",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchUserActivity();
  }, [userId]);

  const summaryRows = useMemo(
    () =>
      summaryCards.map((card) => ({
        ...card,
        value:
          card.key === "lastActivityAt"
            ? formatDateTime(summary[card.key])
            : Number(summary[card.key] || 0),
      })),
    [summary],
  );

  const filteredSentCampaigns = useMemo(() => sentCampaigns, [sentCampaigns]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="ml-64 flex-1">
        <main className="space-y-6 p-8">
          <section className="px-1 py-1">
            <h1 className="text-3xl font-bold text-gray-900">User Activity</h1>
          </section>

          {error ? (
            <section className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </section>
          ) : null}

          {loading ? (
            <section className="rounded-md border border-indigo-200/60 bg-white px-6 py-10 text-sm text-gray-500">
              Loading user activity...
            </section>
          ) : null}

          {!loading && (
            <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
              <article className="rounded-md border border-indigo-200/60 bg-white p-4 xl:col-span-4">
                <div className="flex items-start gap-4">
                  {user?.avatarUrl ? (
                    <img
                      src={resolveAvatarUrl(user.avatarUrl)}
                      alt={user?.name || "User"}
                      className="h-16 w-16 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <img
                      src={defaultAvatar}
                      alt="Default avatar"
                      className="h-16 w-16 shrink-0 rounded-full object-cover"
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-2xl font-semibold text-gray-900">
                      {user?.name || "Unknown user"}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      {user?.role ? formatRoleLabel(user.role) : "User"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 border-t border-gray-100 pt-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    User Details
                  </p>
                  <div className="mt-3 space-y-3 text-sm text-gray-700">
                    <p>{user?.email || "-"}</p>
                    <p>{formatDateOnly(user?.createdAt)}</p>
                    <p>Last login: {formatDateTime(user?.lastLoginAt)}</p>
                  </div>
                </div>
              </article>

              <article className="rounded-md border border-indigo-200/60 bg-white p-4 xl:col-span-8">
                <div className="grid grid-cols-2 gap-x-16 gap-y-14 lg:grid-cols-3">
                  {summaryRows.map((card) => {
                    const Icon = card.icon;

                    return (
                      <div key={card.key} className="min-w-0">
                        <div className="mb-2 flex items-center gap-2 text-gray-700">
                          <span
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${card.styleClass}`}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="text-[15px] leading-5 text-gray-700">
                            {card.label}
                          </span>
                        </div>
                        <p className="pl-10 text-2xl font-normal tracking-tight text-gray-900">
                          {card.value}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </article>
            </section>
          )}

          {!loading && (
            <>
              <div className="flex items-center justify-between gap-3 px-1">
                <h2 className="text-lg font-semibold text-gray-900">
                  Campaign Sent Details
                </h2>
                <p className="text-xs text-gray-500">
                  Showing {filteredSentCampaigns.length} campaign record
                  {filteredSentCampaigns.length === 1 ? "" : "s"}
                </p>
              </div>

              <section className="overflow-hidden rounded-md border border-indigo-200/60 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" ref={campaignTableRef}>
                    <thead className="bg-gray-100 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                          Campaigns
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                          Sent At
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                          Recipients
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                          Open %
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                          Click %
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                          Unsubscribe %
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100/70">
                      {filteredSentCampaigns.length > 0 ? (
                        filteredSentCampaigns.map((campaign) => (
                          <tr
                            key={campaign.campaign_id}
                            className="hover:bg-gray-50"
                          >
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {campaign.campaign_name || "-"}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {formatDateTime(
                                campaign.sent_date || campaign.scheduled_date,
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {campaign.total_recipients ?? 0}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {formatPercentage(
                                campaign.total_opened,
                                Number(
                                  campaign.total_sent ||
                                    campaign.total_recipients ||
                                    0,
                                ),
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {formatPercentage(
                                campaign.total_clicked,
                                Number(
                                  campaign.total_sent ||
                                    campaign.total_recipients ||
                                    0,
                                ),
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {formatPercentage(
                                campaign.total_unsubscribed,
                                Number(
                                  campaign.total_sent ||
                                    campaign.total_recipients ||
                                    0,
                                ),
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan="6"
                            className="px-4 py-10 text-center text-sm text-gray-500"
                          >
                            No sent campaigns found for this user.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {filteredSentCampaigns.length > 0 && (
                  <Pagination
                    tableRef={campaignTableRef}
                    options={[15, 30, 50]}
                    footerRadiusClass="rounded-b-md"
                  />
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default UserActivityPage;
