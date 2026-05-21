import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, RotateCcw, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";
import Pagination from "../components/Pagination.jsx";
import api from "../lib/api.js";
import ReactApexChart from "react-apexcharts";

const FEEDBACK_REASON_LABELS = {
  too_frequent: "Too Frequent",
  not_relevant: "Not Relevant",
  never_subscribed: "Never Subscribed",
  spam: "Spam",
  other: "Other",
};

const FEEDBACK_REASON_ORDER = [
  "too_frequent",
  "not_relevant",
  "never_subscribed",
  "spam",
  "other",
];

const formatReason = (value = "") => {
  const key = String(value || "").trim();
  if (!key) {
    return "Unknown";
  }

  return FEEDBACK_REASON_LABELS[key] || key.replace(/_/g, " ");
};

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString();
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
      categories: results.map((r) => formatReason(r.reason)),
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

const UnsubscribeFeedbackInsights = () => {
  const navigate = useNavigate();
  const tableRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [responses, setResponses] = useState([]);
  const [chartResults, setChartResults] = useState([]);
  const [searchValue, setSearchValue] = useState("");
  const [reasonFilter, setReasonFilter] = useState("");

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(
          "/analytics/unsubscribe-feedback/insights",
        );
        setResponses(Array.isArray(data?.responses) ? data.responses : []);
        setChartResults(Array.isArray(data?.chart) ? data.chart : []);
        setError("");
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Failed to load unsubscribe feedback insights",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, []);

  const normalizedChartResults = useMemo(() => {
    const map = new Map();
    chartResults.forEach((entry) => {
      const key = String(entry?.reason || "").trim();
      if (!key) {
        return;
      }
      map.set(key, Number(entry?.count || 0));
    });

    const knownItems = FEEDBACK_REASON_ORDER.map((reason) => ({
      reason,
      count: map.get(reason) || 0,
    }));

    const extraItems = Array.from(map.entries())
      .filter(([reason]) => !FEEDBACK_REASON_ORDER.includes(reason))
      .map(([reason, count]) => ({ reason, count }));

    return [...knownItems, ...extraItems];
  }, [chartResults]);

  const totalResponses = responses.length;

  const reasonOptions = useMemo(() => {
    const keys = new Set();
    responses.forEach((item) => {
      const key = String(item.reason || "").trim();
      if (key) {
        keys.add(key);
      }
    });

    return Array.from(keys).sort((a, b) =>
      formatReason(a).localeCompare(formatReason(b)),
    );
  }, [responses]);

  const filteredResponses = useMemo(() => {
    return responses.filter((item) => {
      const matchesReason = !reasonFilter || item.reason === reasonFilter;

      const query = searchValue.trim().toLowerCase();
      const name = String(item.contact_name || "").toLowerCase();
      const email = String(item.contact_email || "").toLowerCase();
      const comments = String(item.additional_comments || "").toLowerCase();

      const matchesSearch =
        !query ||
        name.includes(query) ||
        email.includes(query) ||
        comments.includes(query);

      return matchesReason && matchesSearch;
    });
  }, [responses, reasonFilter, searchValue]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="ml-64 flex-1">
        <main className="mx-auto max-w-7xl p-8 space-y-6">
          <section className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                User Responses ({totalResponses})
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Review feedback responses and experience trends.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Overview
            </button>
          </section>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <section className="bg-white rounded-md border border-indigo-200/60 p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Summary</h2>
            </div>

            <FeedbackResultsBarChart results={normalizedChartResults} />

            {normalizedChartResults.every((item) => item.count === 0) ? (
              <p className="mt-3 text-sm text-gray-500">
                No unsubscribe feedback yet.
              </p>
            ) : null}
          </section>

          <section className="space-y-3">
            <div className="py-4 flex flex-wrap items-center gap-3">
              <div className="relative min-w-65 flex-1 max-w-xl">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search by contact name or email"
                  className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-indigo-300 focus:outline-none"
                />
              </div>

              <select
                value={reasonFilter}
                onChange={(event) => setReasonFilter(event.target.value)}
                className="min-w-55 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-300 focus:outline-none"
              >
                <option value="">All Options</option>
                {reasonOptions.map((reason) => (
                  <option key={reason} value={reason}>
                    {formatReason(reason)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  setSearchValue("");
                  setReasonFilter("");
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            </div>

            <div className="bg-white rounded-md border border-indigo-200/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table ref={tableRef} className="min-w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Contact
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Option
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Remarks
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Submitted Date
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Joined Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredResponses.map((item) => (
                      <tr key={item.feedback_id} className="hover:bg-gray-50">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-xs">
                              {String(
                                item.contact_name || "U",
                              )[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {item.contact_name || "Unknown"}
                              </p>
                              <p className="text-xs text-gray-500">
                                {item.contact_email || "-"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-gray-700">
                          {formatReason(item.reason)}
                        </td>
                        <td className="px-5 py-3 text-gray-700">
                          {item.additional_comments || "-"}
                        </td>
                        <td className="px-5 py-3 text-gray-700 whitespace-nowrap">
                          {formatDateTime(item.created_at)}
                        </td>
                        <td className="px-5 py-3 text-gray-700 whitespace-nowrap">
                          {formatDateTime(item.joined_date)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!loading && filteredResponses.length === 0 ? (
                <div className="border-t border-gray-100 px-5 py-6 text-sm text-gray-500">
                  No feedback responses found.
                </div>
              ) : null}

              <Pagination tableRef={tableRef} options={[10, 20, 50]} />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default UnsubscribeFeedbackInsights;
