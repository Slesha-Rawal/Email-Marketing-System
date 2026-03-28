import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Mail,
  MousePointer,
  Sparkles,
  TrendingUp,
  UserMinus,
  UserPlus,
} from "lucide-react";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const formatNumber = (value) => Number(value || 0).toLocaleString();

const formatDateLabel = (dateValue) => {
  const date = new Date(dateValue);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const SummaryCard = ({ title, value, subtitle, icon: Icon, styleClass }) => (
  <article className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
        {subtitle ? (
          <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
        ) : null}
      </div>
      <div
        className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${styleClass}`}
      >
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </article>
);

const AudienceGrowthLineChart = ({ timeline }) => {
  const width = 920;
  const height = 300;
  const leftPad = 36;
  const rightPad = 16;
  const topPad = 20;
  const bottomPad = 34;

  const maxValue = Math.max(
    1,
    ...timeline.map((point) =>
      Math.max(
        point.newSubscribers,
        point.unsubscribes,
        point.importedContacts,
      ),
    ),
  );

  const mapX = (index) => {
    if (timeline.length <= 1) {
      return leftPad;
    }

    return (
      leftPad + (index * (width - leftPad - rightPad)) / (timeline.length - 1)
    );
  };

  const mapY = (value) =>
    topPad + ((maxValue - value) * (height - topPad - bottomPad)) / maxValue;

  const buildPath = (key) =>
    timeline
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${mapX(index)} ${mapY(point[key])}`,
      )
      .join(" ");

  const pathSubscribers = buildPath("newSubscribers");
  const pathUnsubscribes = buildPath("unsubscribes");
  const pathImports = buildPath("importedContacts");

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((factor) => {
    const y = topPad + factor * (height - topPad - bottomPad);
    const value = Math.round(maxValue * (1 - factor));
    return { y, value };
  });

  const xTickIndexes =
    timeline.length > 6
      ? [0, 6, 12, 18, 24, timeline.length - 1]
      : timeline.map((_, index) => index);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-72 min-w-195">
        {yTicks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={leftPad}
              y1={tick.y}
              x2={width - rightPad}
              y2={tick.y}
              stroke="#E5E7EB"
              strokeDasharray="4 4"
            />
            <text
              x={8}
              y={tick.y + 4}
              fontSize="11"
              fill="#6B7280"
              fontFamily="inherit"
            >
              {tick.value}
            </text>
          </g>
        ))}

        {xTickIndexes.map((index) => (
          <text
            key={timeline[index].date}
            x={mapX(index)}
            y={height - 10}
            textAnchor="middle"
            fontSize="10"
            fill="#6B7280"
            fontFamily="inherit"
          >
            {formatDateLabel(timeline[index].date)}
          </text>
        ))}

        <path
          d={pathSubscribers}
          fill="none"
          stroke="#10B981"
          strokeWidth="3"
        />
        <path
          d={pathUnsubscribes}
          fill="none"
          stroke="#F43F5E"
          strokeWidth="3"
        />
        <path d={pathImports} fill="none" stroke="#0EA5E9" strokeWidth="3" />
      </svg>
    </div>
  );
};

const EngagementGauge = ({ score }) => {
  const normalized = Math.max(0, Math.min(100, Number(score || 0)));
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (normalized / 100) * circumference;

  return (
    <div className="flex items-center justify-center">
      <svg width="220" height="220" viewBox="0 0 220 220">
        <defs>
          <linearGradient id="overviewEngagement" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#EF4444" />
          </linearGradient>
        </defs>

        <circle
          cx="110"
          cy="110"
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="16"
        />
        <circle
          cx="110"
          cy="110"
          r={radius}
          fill="none"
          stroke="url(#overviewEngagement)"
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 110 110)"
        />

        <text
          x="110"
          y="104"
          textAnchor="middle"
          className="fill-gray-900 text-3xl font-semibold transition-all"
        >
          {Number(score || 0).toFixed(1)}%
        </text>
        <text
          x="110"
          y="126"
          textAnchor="middle"
          className="fill-gray-500 text-xs"
        >
          engagement score
        </text>
      </svg>
    </div>
  );
};

const TopCampaignsBarChart = ({ campaigns }) => {
  const peak = Math.max(
    1,
    ...campaigns.map((item) => Number(item.engagement_score || 0)),
  );

  return (
    <div className="space-y-4">
      {campaigns.map((campaign) => {
        const value = Number(campaign.engagement_score || 0);
        const widthPercent = Math.max(4, (value / peak) * 100);

        return (
          <div key={campaign.campaign_id}>
            <div className="flex items-center justify-between gap-2 text-sm">
              <p className="font-medium text-gray-900 truncate">
                {campaign.campaign_name}
              </p>
            </div>
            <div className="mt-2 h-2.5 rounded-full bg-gray-200">
              <div
                className="h-2.5 rounded-full bg-linear-to-r from-amber-500 to-rose-500"
                style={{ width: `${widthPercent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

function Overview() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const response = await api.get("/analytics/overview");
        setOverview(response.data);
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Failed to load overview data",
        );
      }
    };

    fetchOverview();
  }, []);

  const timeline = useMemo(() => overview?.timeline || [], [overview]);
  const summary = overview?.summary || {
    totalSent: 0,
    totalOpened: 0,
    totalClicked: 0,
    openRate: 0,
    clickRate: 0,
    engagementScore: 0,
  };
  const topCampaigns = overview?.topCampaigns || [];
  const scheduledCampaigns = overview?.scheduledCampaigns || [];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 ml-64">
        <main className="p-8 space-y-6">
          <section className="flex items-end justify-between px-1">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                Welcome back, {user?.name?.split(" ")[0] || "User"}!
              </h2>
              <p className="mt-1 text-sm text-gray-500 font-medium">
                Here's what's happening with your campaigns today.
              </p>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Showing Results</p>
              <p className="text-sm font-semibold text-gray-700">Last 30 Days</p>
            </div>
          </section>

          {error ? (
            <section className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </section>
          ) : null}

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <SummaryCard
              title="Total Sent"
              value={formatNumber(summary.totalSent)}
              subtitle="Lifetime emails sent"
              icon={Mail}
              styleClass="bg-cyan-100 text-cyan-700"
            />
            <SummaryCard
              title="Open Rate"
              value={`${summary.openRate}%`}
              subtitle={`${formatNumber(summary.totalOpened)} lifetime opens`}
              icon={TrendingUp}
              styleClass="bg-emerald-100 text-emerald-700"
            />
            <SummaryCard
              title="Click Rate"
              value={`${summary.clickRate}%`}
              subtitle={`${formatNumber(summary.totalClicked)} lifetime clicks`}
              icon={MousePointer}
              styleClass="bg-amber-100 text-amber-700"
            />
            <SummaryCard
              title="Engagement"
              value={`${summary.engagementScore.toFixed(1)}%`}
              subtitle="Audience engagement"
              icon={Sparkles}
              styleClass="bg-rose-100 text-rose-700"
            />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <article className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-lg font-semibold text-gray-900">
                  Audience Growth
                </h2>
                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    New subscribers
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    Unsubscribes
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-sky-500" />
                    Imported contacts
                  </span>
                </div>
              </div>

              {timeline.length > 0 ? (
                <AudienceGrowthLineChart timeline={timeline} />
              ) : (
                <p className="text-sm text-gray-500">
                  No audience growth data in this period.
                </p>
              )}

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border border-gray-200 px-4 py-3">
                  <p className="text-xs text-gray-500">New Subscribers</p>
                  <p className="text-xl font-semibold text-gray-900 inline-flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-emerald-600" />
                    {formatNumber(overview?.audienceGrowth?.newSubscribers)}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 px-4 py-3">
                  <p className="text-xs text-gray-500">Unsubscribes</p>
                  <p className="text-xl font-semibold text-gray-900 inline-flex items-center gap-2">
                    <UserMinus className="h-4 w-4 text-rose-600" />
                    {formatNumber(overview?.audienceGrowth?.unsubscribes)}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 px-4 py-3">
                  <p className="text-xs text-gray-500">Imported Contacts</p>
                  <p className="text-xl font-semibold text-gray-900 inline-flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-sky-600" />
                    {formatNumber(overview?.audienceGrowth?.importedContacts)}
                  </p>
                </div>
              </div>
            </article>

            <article className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Engagement Score
              </h2>
              <EngagementGauge score={summary.engagementScore} />
              <p className="text-center text-xs text-gray-500 -mt-2">
                Based on opens and clicks against total sent.
              </p>
            </article>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <article className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Top 5 Campaigns (Engagement)
              </h2>

              {topCampaigns.length > 0 ? (
                <TopCampaignsBarChart campaigns={topCampaigns} />
              ) : (
                <p className="text-sm text-gray-500">
                  No sent campaigns found in last month.
                </p>
              )}
            </article>

            <article className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Scheduled Campaigns
              </h2>
              <p className="text-xs text-gray-500 mt-1 mb-4">Top 5 upcoming</p>

              <div className="space-y-3">
                {scheduledCampaigns.map((campaign) => (
                  <div
                    key={campaign.campaign_id}
                    className="rounded-lg border border-gray-200 px-3 py-2"
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {campaign.campaign_name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {campaign.scheduled_date
                        ? new Date(campaign.scheduled_date).toLocaleString()
                        : "Not scheduled"}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Recipients: {formatNumber(campaign.total_recipients)}
                    </p>
                  </div>
                ))}

                {scheduledCampaigns.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No scheduled campaigns.
                  </p>
                ) : null}
              </div>
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}

export default Overview;
