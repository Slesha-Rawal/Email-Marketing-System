import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, TrendingUp, UserMinus, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ReactApexChart from "react-apexcharts";
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

const formatFeedbackReason = (reason) => {
  const labels = {
    too_frequent: "Too Frequent",
    not_relevant: "Not Relevant",
    never_subscribed: "Never Subscribed",
    spam: "Spam",
    other: "Other",
  };

  return labels[reason] || reason || "Unknown";
};

const FEEDBACK_REASON_ORDER = [
  "too_frequent",
  "not_relevant",
  "never_subscribed",
  "spam",
  "other",
];

const SummaryCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  styleClass,
  ready,
  index,
}) => (
  <article
    className="rounded-md border border-indigo-200/60 bg-white p-5"
    style={{
      opacity: ready ? 1 : 0,
      transform: ready ? "translateY(0px)" : "translateY(10px)",
      transition: `opacity 380ms ease ${index * 70}ms, transform 380ms ease ${
        index * 70
      }ms`,
    }}
  >
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

const AudienceGrowthLineChart = ({ timeline, ready }) => {
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }),
    [],
  );

  const series = useMemo(
    () => [
      {
        name: "Unsubscribes",
        data: timeline.map((point) => Number(point.unsubscribes || 0)),
      },
      {
        name: "Imported Contacts",
        data: timeline.map((point) => Number(point.importedContacts || 0)),
      },
    ],
    [timeline],
  );

  const options = useMemo(
    () => ({
      chart: {
        type: "line",
        toolbar: { show: false },
        animations: {
          enabled: true,
          easing: "easeinout",
          speed: 800,
          animateGradually: {
            enabled: true,
            delay: 120,
          },
          dynamicAnimation: {
            enabled: true,
            speed: 300,
          },
        },
        zoom: { enabled: false },
      },
      colors: ["#F43F5E", "#0EA5E9"],
      dataLabels: { enabled: false },
      grid: {
        borderColor: "#E5E7EB",
        strokeDashArray: 4,
        padding: {
          left: 8,
          right: 8,
          top: 4,
          bottom: 0,
        },
      },
      legend: {
        show: true,
        position: "top",
        horizontalAlign: "left",
        fontSize: "12px",
        fontWeight: 400,
        labels: {
          colors: "#6B7280",
          useSeriesColors: false,
        },
        markers: {
          width: 3,
          height: 3,
          radius: 999,
        },
      },
      stroke: {
        curve: "smooth",
        width: [2.5, 2.5],
        lineCap: "round",
      },
      markers: {
        size: 4,
        strokeWidth: 0,
        hover: {
          size: 6,
          sizeOffset: 2,
        },
      },
      tooltip: {
        shared: true,
        intersect: false,
        followCursor: false,
        marker: {
          show: false,
        },
        custom: ({ series: tooltipSeries, dataPointIndex, w }) => {
          if (dataPointIndex < 0) {
            return "";
          }

          const label =
            timeline[dataPointIndex]?.date || w.globals.labels[dataPointIndex];
          const formattedLabel = label
            ? dateFormatter.format(new Date(label))
            : "";

          const rows = w.globals.seriesNames
            .map((name, index) => {
              const value = Number(tooltipSeries[index]?.[dataPointIndex] || 0);
              return `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:1px 0;">
                  <span style="display:inline-flex;align-items:center;gap:6px;color:#F9FAFB;font-size:11px;line-height:1.3;">
                    <span style="width:6px;height:6px;border-radius:999px;background:${w.globals.colors[index]};flex:0 0 auto;"></span>
                    ${name}
                  </span>
                  <span style="color:#FFFFFF;font-size:11px;font-weight:600;line-height:1.3;">${value.toLocaleString()}</span>
                </div>
              `;
            })
            .join("");

          return `
            <div style="background:#111827;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:8px 10px;box-shadow:0 12px 28px rgba(15,23,42,0.22);min-width:170px;">
              <div style="color:#FFFFFF;font-size:11px;font-weight:700;line-height:1.3;margin-bottom:6px;letter-spacing:0.01em;">${formattedLabel}</div>
              <div style="display:flex;flex-direction:column;gap:3px;">${rows}</div>
            </div>
          `;
        },
        x: {
          formatter: (_, { dataPointIndex }) => {
            const label = timeline[dataPointIndex]?.date;
            return label ? dateFormatter.format(new Date(label)) : "";
          },
        },
        y: {
          formatter: (value, { seriesIndex, w }) =>
            `${w.globals.seriesNames[seriesIndex]}: ${Number(value || 0).toLocaleString()}`,
        },
      },
      xaxis: {
        categories: timeline.map((point) => point.date),
        crosshairs: {
          show: true,
          stroke: {
            color: "#CBD5E1",
            width: 1,
            dashArray: 0,
          },
          position: "back",
        },
        labels: {
          style: {
            colors: "#6B7280",
            fontSize: "10px",
          },
          formatter: (value) =>
            value ? dateFormatter.format(new Date(value)) : "",
        },
        axisBorder: {
          color: "#E5E7EB",
        },
        axisTicks: {
          color: "#E5E7EB",
        },
      },
      yaxis: {
        labels: {
          style: {
            colors: "#6B7280",
            fontSize: "11px",
          },
          formatter: (value) => Number(value || 0).toLocaleString(),
        },
      },
      fill: {
        opacity: 1,
      },
      responsive: [
        {
          breakpoint: 640,
          options: {
            markers: {
              size: 3,
              hover: {
                size: 5,
                sizeOffset: 1,
              },
            },
          },
        },
      ],
    }),
    [dateFormatter, timeline],
  );

  return (
    <div className="w-full">
      <div
        className="transition-opacity duration-500"
        style={{ opacity: ready ? 1 : 0 }}
      >
        <ReactApexChart
          options={options}
          series={series}
          type="line"
          height={300}
        />
      </div>
    </div>
  );
};

const TopCampaignsListCard = ({ campaigns, ready }) => {
  const formattedCampaigns = campaigns.map((campaign) => ({
    ...campaign,
    openRate:
      Number(campaign.total_sent || 0) > 0
        ? Number(
            (
              (Number(campaign.total_opened || 0) /
                Number(campaign.total_sent || 0)) *
              100
            ).toFixed(1),
          )
        : 0,
    clickRate:
      Number(campaign.total_sent || 0) > 0
        ? Number(
            (
              (Number(campaign.total_clicked || 0) /
                Number(campaign.total_sent || 0)) *
              100
            ).toFixed(1),
          )
        : 0,
  }));

  return (
    <div className="rounded-md border border-indigo-200/60 bg-white px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-gray-900 tracking-tight">
          Top 5 Well-Performing Campaigns
        </h3>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_auto] items-center gap-5 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <span className="text-right">Open </span>
        <span className="text-right">Click </span>
      </div>

      <div className="space-y-1">
        {formattedCampaigns.map((campaign, index) => (
          <div
            key={campaign.campaign_id}
            className={`grid grid-cols-[1fr_auto_auto] items-center gap-5 rounded-md px-2.5 py-2.5 transition-colors ${
              index % 2 === 0 ? "bg-transparent" : "bg-white/60"
            }`}
            style={{
              opacity: ready ? 1 : 0,
              transition: `opacity 320ms ease ${index * 80}ms`,
            }}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-600">
                {campaign.campaign_name}
              </p>
            </div>

            <div className="text-right">
              <span className="text-sm font-medium text-indigo-700 tabular-nums">
                {campaign.openRate.toFixed(1)}%
              </span>
            </div>

            <div className="text-right">
              <span className="text-sm font-medium text-indigo-700 tabular-nums">
                {campaign.clickRate.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const FeedbackResultsBarChart = ({ results }) => {
  const peak = Math.max(1, ...results.map((r) => Number(r.count || 0)));
  const yAxisMax = peak + 2;

  const options = {
    chart: {
      type: "bar",
      toolbar: { show: false },
      animations: {
        enabled: true,
        easing: "easeinout",
        speed: 800,
        dynamicAnimation: {
          enabled: true,
          speed: 350,
        },
      },
    },
    plotOptions: {
      bar: {
        borderRadius: 6,
        columnWidth: "25%",
        dataLabels: {
          position: "top", // top, center, bottom
        },
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (val) => val,
      offsetY: -20,
      style: {
        fontSize: "12px",
        colors: ["#304758"],
      },
    },
    xaxis: {
      categories: results.map((r) => formatFeedbackReason(r.reason)),
      position: "bottom",
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false },
    },
    yaxis: {
      max: yAxisMax,
      tickAmount: yAxisMax,
      labels: {
        formatter: (val) => Math.round(val),
      },
    },
    colors: ["#4F46E5"],
    fill: {
      type: "gradient",
      gradient: {
        shade: "light",
        type: "vertical",
        shadeIntensity: 0.25,
        inverseColors: false,
        opacityFrom: 1,
        opacityTo: 0.8,
        stops: [0, 100],
      },
    },
  };

  const series = [
    {
      name: "Count",
      data: results.map((r) => Number(r.count || 0)),
    },
  ];

  return (
    <div className="w-full">
      <ReactApexChart
        options={options}
        series={series}
        type="bar"
        height={320}
      />
    </div>
  );
};

const EngagementSplitWidget = ({ total, opens, clicks }) => {
  const safeTotal = Math.max(Number(total || 0), 1);
  const opensValue = Number(opens || 0);
  const clicksValue = Number(clicks || 0);
  const remainingValue = Math.max(safeTotal - opensValue - clicksValue, 0);

  const series = [opensValue, clicksValue, remainingValue];

  const options = {
    chart: {
      type: "donut",
    },
    labels: ["Opens", "Clicks", "Remaining"],
    colors: ["#8B8AE6", "#8FB6D9", "#E6C26A"],
    plotOptions: {
      pie: {
        donut: {
          size: "60%",
        },
      },
    },
    dataLabels: {
      enabled: false,
    },
    legend: {
      show: true,
      position: "bottom",
      itemMargin: {
        horizontal: 10,
        vertical: 5,
      },
      markers: {
        radius: 12,
      },
    },
    stroke: {
      width: 2,
    },
    tooltip: {
      y: {
        formatter: (val) => `${val} (${((val / safeTotal) * 100).toFixed(1)}%)`,
      },
    },
  };

  return (
    <div className="rounded-md border border-indigo-200/60 bg-white p-6 flex flex-col h-full">
      <h3 className="text-sm font-semibold text-gray-900">Engagement Split</h3>
      <p className="mb-6 mt-1 text-xs text-gray-500">
        Open, click, and remaining share
      </p>

      <div className="mx-auto flex w-full flex-col items-center flex-1 justify-center">
        <ReactApexChart
          options={options}
          series={series}
          type="donut"
          height={260}
          width="100%"
        />
      </div>
    </div>
  );
};

function Overview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchOverview = async ({ showLoading = false } = {}) => {
      if (showLoading) {
        setLoading(true);
      }

      try {
        const response = await api.get("/analytics/overview", {
          params: { t: Date.now() },
          meta: {
            skipSuccessToast: true,
            skipErrorToast: true,
          },
        });

        if (!isMounted) {
          return;
        }

        setOverview(response.data);
        setError("");
      } catch (requestError) {
        if (!isMounted) {
          return;
        }

        setError(
          requestError.response?.data?.message ||
            "Failed to load overview data",
        );
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchOverview({ showLoading: true });

    const refreshIntervalId = window.setInterval(() => {
      fetchOverview({ showLoading: false });
    }, 20000);

    const handleVisibilityRefresh = () => {
      if (!document.hidden) {
        fetchOverview({ showLoading: false });
      }
    };

    const handleWindowFocusRefresh = () => {
      fetchOverview({ showLoading: false });
    };

    document.addEventListener("visibilitychange", handleVisibilityRefresh);
    window.addEventListener("focus", handleWindowFocusRefresh);

    return () => {
      isMounted = false;
      window.clearInterval(refreshIntervalId);
      document.removeEventListener("visibilitychange", handleVisibilityRefresh);
      window.removeEventListener("focus", handleWindowFocusRefresh);
    };
  }, []);

  useEffect(() => {
    setChartReady(false);
    const timerId = window.setTimeout(() => setChartReady(true), 60);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [overview]);

  const timeline = useMemo(() => overview?.timeline || [], [overview]);
  const summary = overview?.summary || {
    totalCampaignsRun: 0,
    totalSent: 0,
    totalOpened: 0,
    totalClicked: 0,
    engagementRate: 0,
    unsubscribeRate: 0,
  };
  const topCampaigns = overview?.topCampaigns || [];
  const scheduledCampaigns = overview?.scheduledCampaigns || [];
  const unsubscribeFeedbackResults = useMemo(() => {
    const rawResults = overview?.unsubscribeFeedbackResults || [];
    const countsByReason = new Map(
      rawResults.map((item) => [item.reason, Number(item.count || 0)]),
    );

    return FEEDBACK_REASON_ORDER.map((reason) => ({
      reason,
      count: countsByReason.get(reason) || 0,
    }));
  }, [overview]);

  const engagementSplitTotal =
    Number(summary.totalSent || 0) > 0
      ? Number(summary.totalSent || 0)
      : Number(summary.totalOpened || 0) + Number(summary.totalClicked || 0);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 ml-64">
        <main className="p-8 space-y-6">
          <section className="flex flex-wrap items-end justify-between gap-4 px-1">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                Welcome back, {user?.name?.split(" ")[0] || "User"}!
              </h2>
              <p className="mt-1 text-sm text-gray-500 font-medium">
                Here&apos;s what your audience is doing right now.
              </p>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Showing Results
              </p>
              <p className="text-sm font-semibold text-gray-700">
                Last 30 Days
              </p>
            </div>
          </section>

          {error ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <article
                  key={`overview-skeleton-${index}`}
                  className="rounded-md border border-indigo-200/60 bg-white p-5"
                >
                  <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
                  <div className="mt-3 h-8 w-24 animate-pulse rounded bg-gray-200" />
                  <div className="mt-3 h-3 w-36 animate-pulse rounded bg-gray-100" />
                </article>
              ))}
            </section>
          ) : null}

          <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SummaryCard
              title="Total Contacts"
              value={formatNumber(overview?.totalContacts || 0)}
              subtitle="Active and inactive contacts"
              icon={Users}
              styleClass="bg-indigo-100 text-indigo-700"
              ready={chartReady}
              index={0}
            />
            <SummaryCard
              title="Total Campaigns Run"
              value={formatNumber(summary.totalCampaignsRun)}
              subtitle="Sent and sending campaigns"
              icon={BarChart3}
              styleClass="bg-sky-100 text-sky-700"
              ready={chartReady}
              index={1}
            />
            <SummaryCard
              title="Engagement Rate"
              value={`${Number(summary.engagementRate || 0).toFixed(1)}%`}
              subtitle={`${formatNumber(summary.totalOpened)} opens and ${formatNumber(summary.totalClicked)} clicks`}
              icon={TrendingUp}
              styleClass="bg-[#E3F2E5] text-[#66B35D]"
              ready={chartReady}
              index={2}
            />
            <SummaryCard
              title="Unsubscribe Rate"
              value={`${Number(summary.unsubscribeRate || 0).toFixed(1)}%`}
              subtitle="Unsubscribes from sent campaigns"
              icon={UserMinus}
              styleClass="bg-[#FFEAFC] text-[#E08BDF]"
              ready={chartReady}
              index={3}
            />
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="bg-white rounded-md border border-indigo-200/60 p-6 xl:col-span-8">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-lg font-semibold text-gray-900">
                  Audience Growth
                </h2>
              </div>

              {timeline.length > 0 ? (
                <AudienceGrowthLineChart
                  timeline={timeline}
                  ready={chartReady}
                />
              ) : (
                <p className="text-sm text-gray-500">
                  No audience growth data in this period.
                </p>
              )}
            </div>

            <div className="xl:col-span-4">
              <EngagementSplitWidget
                total={engagementSplitTotal}
                opens={summary.totalOpened}
                clicks={summary.totalClicked}
              />
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <article className="xl:col-span-2">
              {topCampaigns.length > 0 ? (
                <TopCampaignsListCard
                  campaigns={topCampaigns}
                  ready={chartReady}
                />
              ) : (
                <div className="rounded-md border border-indigo-200/60 bg-white px-4 py-4">
                  <h3 className="text-[18px] font-semibold text-gray-900 tracking-tight">
                    Top 5 Well-Performing Campaigns
                  </h3>
                  <p className="mt-4 text-sm text-gray-500">
                    No sent campaigns found in last month.
                  </p>
                </div>
              )}
            </article>

            <article className="bg-white rounded-md border border-indigo-200/60 p-6">
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

          <section className="bg-white rounded-md border border-indigo-200/60 p-6">
            <div className="flex items-center justify-between gap-3 mb-6">
              <h2 className="text-[18px] font-semibold text-gray-900 tracking-tight">
                Feedback Results: Why did recipients unsubscribe?
              </h2>
              <button
                onClick={() =>
                  navigate("/analytics/unsubscribe-feedback/insights")
                }
                className="inline-flex items-center gap-2 rounded-lg border border-indigo-600 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-50"
              >
                View Insights
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

            <FeedbackResultsBarChart results={unsubscribeFeedbackResults} />
          </section>
        </main>
      </div>
    </div>
  );
}

export default Overview;
