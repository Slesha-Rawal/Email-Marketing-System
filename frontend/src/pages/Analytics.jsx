import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Eye,
  FileText,
  MousePointer,
  Search,
  Send,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";
import Pagination from "../components/Pagination.jsx";
import DateRangeFilter from "../components/contacts/DateRangeFilter.jsx";

const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

const Analytics = () => {
  const navigate = useNavigate();
  const dateMenuRef = useRef(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chartReady, setChartReady] = useState(false);
  const [campaignNameSearch, setCampaignNameSearch] = useState("");
  const [stats, setStats] = useState({
    emailsSent: 0,
    opens: 0,
    clicks: 0,
    totalContacts: 0,
    totalCampaigns: 0,
    totalTemplates: 0,
  });
  const [campaignPerformance, setCampaignPerformance] = useState([]);
  const [error, setError] = useState("");
  const tableRef = useRef(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const [analyticsResult, performanceResult] = await Promise.allSettled([
          api.get("/analytics"),
          api.get("/analytics/campaigns/performance"),
        ]);

        if (analyticsResult.status !== "fulfilled") {
          throw analyticsResult.reason;
        }

        const response = analyticsResult.value;
        setStats({
          emailsSent: response.data.summary.emailsSent,
          opens: response.data.summary.opens,
          clicks: response.data.summary.clicks,
          totalContacts: response.data.summary.totalContacts,
          totalCampaigns: response.data.summary.totalCampaigns,
          totalTemplates: response.data.summary.totalTemplates,
        });

        if (performanceResult.status === "fulfilled") {
          setCampaignPerformance(
            Array.isArray(performanceResult.value.data?.campaigns)
              ? performanceResult.value.data.campaigns
              : [],
          );
        } else {
          setCampaignPerformance([]);
        }

        setError("");
      } catch (requestError) {
        setError(
          requestError.response?.data?.message || "Failed to load analytics",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  useEffect(() => {
    setChartReady(false);
    const timerId = window.setTimeout(() => setChartReady(true), 50);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [campaignPerformance, startDate, endDate]);

  const filteredCampaignPerformance = useMemo(() => {
    if (!startDate && !endDate) {
      return campaignPerformance;
    }

    return campaignPerformance.filter((campaign) => {
      const sentAt = campaign.sent_date;
      if (!sentAt) {
        return true;
      }

      const campaignDate = new Date(sentAt);
      if (startDate && campaignDate < new Date(startDate)) {
        return false;
      }
      if (endDate && campaignDate > new Date(endDate)) {
        return false;
      }

      return true;
    });
  }, [campaignPerformance, endDate, startDate]);

  const visibleCampaignPerformance = useMemo(() => {
    const query = campaignNameSearch.trim().toLowerCase();

    if (!query) {
      return filteredCampaignPerformance;
    }

    return filteredCampaignPerformance.filter((campaign) =>
      String(campaign.campaign_name || "")
        .toLowerCase()
        .includes(query),
    );
  }, [campaignNameSearch, filteredCampaignPerformance]);

  const summary = useMemo(
    () =>
      filteredCampaignPerformance.reduce(
        (acc, campaign) => ({
          emailsSent: acc.emailsSent + Number(campaign.sent_count || 0),
          opens: acc.opens + Number(campaign.open_count || 0),
          clicks: acc.clicks + Number(campaign.click_count || 0),
          unsubscribes:
            acc.unsubscribes + Number(campaign.unsubscribe_count || 0),
          activeCampaigns: acc.activeCampaigns + 1,
        }),
        {
          emailsSent: 0,
          opens: 0,
          clicks: 0,
          unsubscribes: 0,
          activeCampaigns: 0,
        },
      ),
    [filteredCampaignPerformance],
  );

  const openRate =
    summary.emailsSent > 0 ? (summary.opens / summary.emailsSent) * 100 : 0;
  const clickRate =
    summary.emailsSent > 0 ? (summary.clicks / summary.emailsSent) * 100 : 0;

  const unsubscribeRate =
    summary.emailsSent > 0
      ? (summary.unsubscribes / summary.emailsSent) * 100
      : 0;

  const kpiCards = [
    {
      key: "emailsSent",
      label: "Total Sent",
      value: Number(summary.emailsSent || 0).toLocaleString(),
      sub: "Emails Sent",
      Icon: Send,
      tone: "bg-indigo-100 text-indigo-600",
    },
    {
      key: "openRate",
      label: "Open Rate",
      value: formatPercent(openRate),
      sub: `${Number(summary.opens || 0).toLocaleString()} opens`,
      Icon: Eye,
      tone: "bg-[#E3F2E5] text-[#66B35D]",
    },
    {
      key: "clickRate",
      label: "Click Rate",
      value: formatPercent(clickRate),
      sub: `${Number(summary.clicks || 0).toLocaleString()} clicks`,
      Icon: MousePointer,
      tone: "bg-rose-100 text-rose-600",
    },
    {
      key: "unsubscribeRate",
      label: "Unsubscribe Rate",
      value: formatPercent(unsubscribeRate),
      sub: `${Number(summary.unsubscribes || 0).toLocaleString()} unsubscribes`,
      Icon: Activity,
      tone: "bg-amber-100 text-amber-600",
    },
    {
      key: "activeCampaigns",
      label: "Total Campaigns",
      value: Number(summary.activeCampaigns || 0).toLocaleString(),
      sub: `${Number(stats.totalTemplates || 0).toLocaleString()} templates in use`,
      Icon: FileText,
      tone: "bg-sky-100 text-sky-600",
    },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 ml-64">
        <main className="p-8 space-y-6">
          <section className="px-1 py-1">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Meaningful campaign insights with trend-focused storytelling.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <DateRangeFilter
                  menuRef={dateMenuRef}
                  isOpen={isDateMenuOpen}
                  onToggle={() => setIsDateMenuOpen((prev) => !prev)}
                  selectedLabel={
                    startDate || endDate
                      ? `${startDate || "Start"} - ${endDate || "End"}`
                      : "Date Range"
                  }
                  isRangeActive={Boolean(startDate || endDate)}
                  dateFrom={startDate}
                  dateTo={endDate}
                  onDateRangeChange={({ from, to }) => {
                    setStartDate(from || "");
                    setEndDate(to || "");
                  }}
                  onClear={() => {
                    setStartDate("");
                    setEndDate("");
                    setIsDateMenuOpen(false);
                  }}
                  align="right"
                />
              </div>
            </div>
          </section>

          {error ? (
            <section className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </section>
          ) : null}

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {loading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <article
                    key={`analytics-kpi-skeleton-${index}`}
                    className="rounded-md border border-indigo-200/60 bg-white p-5"
                  >
                    <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                    <div className="mt-3 h-8 w-18 animate-pulse rounded bg-gray-200" />
                    <div className="mt-3 h-3 w-30 animate-pulse rounded bg-gray-100" />
                  </article>
                ))
              : kpiCards.map(({ key, label, value, sub, Icon, tone }) => (
                  <article
                    key={key}
                    className="rounded-md border border-indigo-200/60 bg-white p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {label}
                      </p>
                      <span
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                    </div>
                    <p className="text-2xl font-semibold text-gray-900">
                      {value}
                    </p>
                    <p className="mt-2 text-xs text-gray-500">{sub}</p>
                  </article>
                ))}
          </section>

          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-semibold text-gray-900">
              Detailed Email Performance
            </h2>
            <p className="text-xs text-gray-500">
              Showing {visibleCampaignPerformance.length} campaign record
              {visibleCampaignPerformance.length === 1 ? "" : "s"}
            </p>
          </div>

          <section className="overflow-hidden rounded-md border border-indigo-200/60 bg-white">
            <div className="border-b border-gray-100 px-4 py-3">
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={campaignNameSearch}
                  onChange={(event) =>
                    setCampaignNameSearch(event.target.value)
                  }
                  placeholder="Search campaign name"
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:border-indigo-300 focus:outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm" ref={tableRef}>
                <thead className="bg-gray-100 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Campaign
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Sent At
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Sent
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Opened
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Clicked
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Open %
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Click %
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Unsubscribe %
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/70">
                  {visibleCampaignPerformance.map((campaign) => (
                    <tr key={campaign.campaign_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {campaign.campaign_name || "Untitled Campaign"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {campaign.sent_date
                          ? new Date(campaign.sent_date).toLocaleString()
                          : "Not available"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {Number(campaign.sent_count || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {Number(campaign.open_count || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {Number(campaign.click_count || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {formatPercent(campaign.open_rate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {formatPercent(campaign.click_rate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {formatPercent(campaign.unsubscribe_rate)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/analytics/campaigns/${campaign.campaign_id}/recipients`,
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                        >
                          <Users className="h-3.5 w-3.5" />
                          Activity
                        </button>
                      </td>
                    </tr>
                  ))}

                  {visibleCampaignPerformance.length === 0 && (
                    <tr>
                      <td
                        colSpan="9"
                        className="px-4 py-8 text-center text-sm text-gray-500"
                      >
                        No campaign analytics found for the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {visibleCampaignPerformance.length > 0 && (
              <Pagination
                tableRef={tableRef}
                options={[15, 30, 50]}
                footerRadiusClass="rounded-b-md"
              />
            )}
          </section>
        </main>
      </div>
    </div>
  );
};

export default Analytics;
