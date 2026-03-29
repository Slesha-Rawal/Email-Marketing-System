import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";
import { Search } from "lucide-react";

const avatarToneClasses = [
  "bg-indigo-100 text-indigo-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
];

const getInitials = (name = "") => {
  const cleanName = String(name).trim();
  if (!cleanName) {
    return "?";
  }

  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
};

const EmailLogs = () => {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [templateFilter, setTemplateFilter] = useState("");
  const [recipientFilter, setRecipientFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchTemplates();
    fetchLogs();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await api.get("/templates");
      setTemplates(res.data);
    } catch (e) {
      // ignore
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (search) params.search = search;
      if (templateFilter) params.template = templateFilter;
      if (recipientFilter) params.recipient = recipientFilter;
      if (dateFilter) params.date = dateFilter;
      const res = await api.get("/email-logs", { params });
      setLogs(res.data);
    } catch (e) {
      setError(e.response?.data?.message || "Failed to load email logs");
    } finally {
      setLoading(false);
    }
  };

  const renderRecipientBadges = (log) => {
    const names = String(log.recipient_names || "")
      .split("||")
      .map((item) => item.trim())
      .filter(Boolean);

    const totalRecipients = Number(log.total_recipients);
    const boundedNames =
      Number.isFinite(totalRecipients) && totalRecipients > 0
        ? names.slice(0, totalRecipients)
        : names;

    if (boundedNames.length === 0) {
      return <span className="text-gray-400">-</span>;
    }

    const visibleNames = boundedNames.slice(0, 3);
    const remainingCount = boundedNames.length - visibleNames.length;

    return (
      <div className="flex items-center" title={boundedNames.join(", ")}>
        {visibleNames.map((name, index) => (
          <div
            key={`${log.id}-${name}-${index}`}
            className={`h-10 w-10 rounded-full border-2 border-white text-sm font-semibold flex items-center justify-center ${avatarToneClasses[index % avatarToneClasses.length]} ${index === 0 ? "ml-0" : "-ml-2"}`}
          >
            {getInitials(name)}
          </div>
        ))}
        {remainingCount > 0 && (
          <div className="-ml-2 h-10 w-10 rounded-full border-2 border-white bg-gray-100 text-gray-700 text-sm font-semibold flex items-center justify-center">
            +{remainingCount}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <div className="p-8 max-w-7xl mx-auto w-full">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Email Logs</h1>
            <p className="mt-1 text-sm text-gray-500">
              View all sent emails, filter by date, template, or recipient.
            </p>
          </header>

          <div className="flex flex-wrap gap-4 mb-8 items-end">
            <div className="flex-1 max-w-xs">
              <div className="relative rounded-lg border border-gray-200 bg-white transition-all focus-within:border-indigo-300">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-colors" />
                <input
                  type="text"
                  placeholder="Search by subject or sender..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-transparent border-0 rounded-lg focus:outline-none text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Template
              </label>
              <select
                value={templateFilter}
                onChange={(e) => setTemplateFilter(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">All</option>
                {templates.map((t) => (
                  <option key={t.template_id} value={t.template_id}>
                    {t.template_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Recipient
              </label>
              <div className="relative rounded-lg border border-gray-200 bg-white transition-all focus-within:border-indigo-300">
                <input
                  type="text"
                  value={recipientFilter}
                  onChange={(e) => setRecipientFilter(e.target.value)}
                  placeholder="Name or email"
                  className="w-full px-3 py-2 bg-transparent border-0 rounded-lg focus:outline-none text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <div className="relative rounded-lg border border-gray-200 bg-white transition-all focus-within:border-indigo-300">
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-transparent border-0 rounded-lg focus:outline-none text-sm"
                />
              </div>
            </div>
            <button
              onClick={fetchLogs}
              className="ml-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 shadow transition-all"
            >
              Filter
            </button>
          </div>

          {error && (
            <div className="mb-4 text-red-600 text-sm font-medium">{error}</div>
          )}

          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-700">
                  <th className="px-4 py-3 text-left font-semibold">Sent At</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Template
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Sent By</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Total Recipients
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Recipients
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Success</th>
                  <th className="px-4 py-3 text-left font-semibold">Failed</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400">
                      Loading...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400">
                      No email logs found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-t border-gray-100 hover:bg-gray-50 transition-all"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        {log.sent_at
                          ? new Date(log.sent_at).toLocaleString()
                          : "-"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {log.template_name || "-"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {log.sent_by || "-"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {log.total_recipients ?? "-"}
                      </td>
                      <td className="px-4 py-3 min-w-45">
                        {renderRecipientBadges(log)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-emerald-700 font-semibold">
                        {log.success_count ?? 0}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-red-600 font-semibold">
                        {log.fail_count ?? 0}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailLogs;
