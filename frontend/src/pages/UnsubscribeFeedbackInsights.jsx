import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, RotateCcw, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";
import Pagination from "../components/Pagination.jsx";
import api from "../lib/api.js";

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

const FeedbackResultsBarChart = ({ results, ready }) => {
  const width = 920;
  const height = 290;
  const leftPad = 42;
  const rightPad = 20;
  const topPad = 22;
  const bottomPad = 70;

  const peak = Math.max(1, ...results.map((item) => Number(item.count || 0)));
  const chartHeight = height - topPad - bottomPad;
  const chartWidth = width - leftPad - rightPad;
  const slotWidth = chartWidth / Math.max(1, results.length);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((factor) => ({
    y: topPad + factor * chartHeight,
    value: Math.round(peak * (1 - factor)),
  }));

  const bars = results.map((item, index) => {
    const value = Number(item.count || 0);
    const barWidth = Math.min(74, slotWidth * 0.58);
    const x = leftPad + index * slotWidth + (slotWidth - barWidth) / 2;
    const scaledHeight = (value / peak) * chartHeight;
    const barHeight = value > 0 ? Math.max(6, scaledHeight) : 0;
    const y = topPad + chartHeight - barHeight;

    return {
      reason: item.reason,
      value,
      x,
      y,
      barWidth,
      barHeight,
      centerX: x + barWidth / 2,
    };
  });

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-72 w-full">
        {yTicks.map((tick) => (
          <g key={`feedback-insights-tick-${tick.value}`}>
            <line
              x1={leftPad}
              y1={tick.y}
              x2={width - rightPad}
              y2={tick.y}
              stroke="#E5E7EB"
              strokeWidth="1"
            />
            <text
              x={10}
              y={tick.y + 4}
              fontSize="11"
              fill="#6B7280"
              fontFamily="inherit"
            >
              {tick.value}
            </text>
          </g>
        ))}

        {bars.map((bar) => (
          <g key={`feedback-insights-bar-${bar.reason}`}>
            <rect
              x={bar.x}
              y={ready ? bar.y : topPad + chartHeight}
              width={bar.barWidth}
              height={ready ? bar.barHeight : 0}
              rx="8"
              fill="url(#feedbackBarGradientInsights)"
              style={{ transition: "height 850ms ease, y 850ms ease" }}
            />
            <text
              x={bar.centerX}
              y={bar.y - 8}
              textAnchor="middle"
              fontSize="11"
              fill="#4B5563"
              fontFamily="inherit"
              opacity={ready ? 1 : 0}
              style={{ transition: "opacity 400ms ease 200ms" }}
            >
              {bar.value}
            </text>
            <text
              x={bar.centerX}
              y={height - 16}
              textAnchor="middle"
              fontSize="11"
              fill="#6B7280"
              fontFamily="inherit"
            >
              {formatReason(bar.reason)}
            </text>
          </g>
        ))}

        <defs>
          <linearGradient
            id="feedbackBarGradientInsights"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#A5B4FC" stopOpacity="0.9" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

const UnsubscribeFeedbackInsights = () => {
  const navigate = useNavigate();
  const tableRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chartReady, setChartReady] = useState(false);
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

  useEffect(() => {
    setChartReady(false);
    const timerId = window.setTimeout(() => setChartReady(true), 60);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [normalizedChartResults]);

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
              <h2 className="text-lg font-semibold text-gray-900">
                Summary
              </h2>
            </div>

            <FeedbackResultsBarChart
              results={normalizedChartResults}
              ready={chartReady}
            />

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
                              {String(item.contact_name || "U")[0].toUpperCase()}
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
