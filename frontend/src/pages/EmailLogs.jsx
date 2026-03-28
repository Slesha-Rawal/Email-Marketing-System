import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";
import { Search } from "lucide-react";

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
            <div className="flex-1 max-w-xs relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                placeholder="Search by subject or sender..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all text-sm"
              />
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
              <input
                type="text"
                value={recipientFilter}
                onChange={(e) => setRecipientFilter(e.target.value)}
                placeholder="Email address"
                className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
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
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
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
                      <td className="px-4 py-3 whitespace-nowrap">
                        {log.status || "-"}
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
