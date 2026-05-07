import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";
import Pagination from "../components/Pagination.jsx";

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
};

const getReadableUrlLabel = (value = "") => {
  const text = String(value || "").trim();
  if (!text) {
    return "-";
  }

  try {
    const parsed = new URL(text);
    const normalizedPath = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${parsed.hostname}${normalizedPath}`;
  } catch {
    return text;
  }
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

function AnalyticsRecipientsActivity() {
  const navigate = useNavigate();
  const { campaignId } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [campaign, setCampaign] = useState(null);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipients, setRecipients] = useState([]);
  const tableRef = useRef(null);

  useEffect(() => {
    const fetchRecipientActivity = async () => {
      try {
        setLoading(true);
        const response = await api.get(
          `/analytics/campaigns/${campaignId}/recipients`,
        );

        setCampaign(response.data?.campaign || null);
        setRecipients(
          Array.isArray(response.data?.recipients)
            ? response.data.recipients
            : [],
        );
        setError("");
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Failed to load campaign recipient activity",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRecipientActivity();
  }, [campaignId]);

  const filteredRecipients = useMemo(() => {
    if (!recipientSearch.trim()) {
      return recipients;
    }

    const value = recipientSearch.trim().toLowerCase();
    return recipients.filter((recipient) => {
      const name = String(recipient.recipient_name || "").toLowerCase();
      const email = String(recipient.recipient_email || "").toLowerCase();
      return name.includes(value) || email.includes(value);
    });
  }, [recipientSearch, recipients]);

  const exportRecipientActivitySheets = () => {
    if (!campaign || !filteredRecipients.length) {
      return;
    }

    const headers = [
      "Recipient Name",
      "Email",
      "Delivered",
      "Opened",
      "Opened At",
      "Clicked",
      "Clicked At",
      "Clicked URLs",
    ];

    const rows = filteredRecipients.map((recipient) => {
      const urls = Array.isArray(recipient.clicked_urls)
        ? recipient.clicked_urls.join(" | ")
        : "-";
      return [
        recipient.recipient_name || "-",
        recipient.recipient_email || "-",
        recipient.delivered ? "Yes" : "No",
        recipient.opened ? "Yes" : "No",
        formatDateTime(recipient.opened_at),
        recipient.clicked ? "Yes" : "No",
        formatDateTime(recipient.clicked_at),
        urls,
      ];
    });

    const csvContent = [
      headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","),
      ...rows.map((row) =>
        row
          .map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `recipient-activity-${campaign.campaign_name.replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="ml-64 flex-1">
        <main className="mx-auto max-w-7xl space-y-6 p-8">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Recipient Activity
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {campaign
                  ? `Campaign: ${campaign.campaign_name}`
                  : "Campaign recipient open/click activity."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/analytics")}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Analytics
            </button>
          </header>

          {error && (
            <section className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </section>
          )}

          <section className="overflow-hidden rounded-md border border-indigo-200/60 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Recipient Activity Table
                </h2>
                <p className="text-xs text-gray-500">
                  Open and click behavior per recipient.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={recipientSearch}
                  onChange={(event) => setRecipientSearch(event.target.value)}
                  placeholder="Search recipient"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={exportRecipientActivitySheets}
                  disabled={!filteredRecipients.length}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                >
                  <Download className="h-4 w-4" />
                  Export to Sheets
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm" ref={tableRef}>
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Recipient
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Delivered
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Opened
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Opened At
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Clicked
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Clicked At
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Clicked URLs
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRecipients.map((recipient) => (
                    <tr
                      key={
                        recipient.campaign_email_id || recipient.recipient_email
                      }
                      className="hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-gray-900">
                        {recipient.recipient_name || "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {recipient.recipient_email || "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {recipient.delivered ? "Yes" : "No"}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {recipient.opened ? "Yes" : "No"}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {formatDateTime(recipient.opened_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {recipient.clicked ? "Yes" : "No"}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {formatDateTime(recipient.clicked_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {(recipient.clicked_urls || []).length ? (
                          <div className="space-y-1">
                            {(recipient.clicked_urls || []).map(
                              (url, index) => (
                                <a
                                  key={`${recipient.campaign_email_id || recipient.recipient_email}-${index}`}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block break-all text-indigo-700 underline-offset-2 hover:underline"
                                  title={url}
                                >
                                  {getReadableUrlLabel(url)}
                                </a>
                              ),
                            )}
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}

                  {loading && (
                    <tr>
                      <td
                        className="px-4 py-8 text-center text-sm text-gray-500"
                        colSpan={8}
                      >
                        Loading recipient activity...
                      </td>
                    </tr>
                  )}

                  {!loading && !filteredRecipients.length && (
                    <tr>
                      <td
                        className="px-4 py-8 text-center text-sm text-gray-500"
                        colSpan={8}
                      >
                        No recipient activity found for this campaign.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {!loading && filteredRecipients.length > 0 && (
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
}

export default AnalyticsRecipientsActivity;
