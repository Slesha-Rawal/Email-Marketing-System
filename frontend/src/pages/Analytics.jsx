import React, { useEffect, useMemo, useState } from "react";
import { Eye, MousePointer, Send, Users } from "lucide-react";
import Header from "../components/Header.jsx";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";

const Analytics = () => {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [stats, setStats] = useState({
    emailsSent: 0,
    opens: 0,
    clicks: 0,
    totalContacts: 0,
  });
  const [campaignAnalytics, setCampaignAnalytics] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await api.get("/analytics");
        setStats({
          emailsSent: response.data.summary.emailsSent,
          opens: response.data.summary.opens,
          clicks: response.data.summary.clicks,
          totalContacts: response.data.summary.totalContacts,
        });
        setCampaignAnalytics(response.data.campaigns);
      } catch (requestError) {
        setError(
          requestError.response?.data?.message || "Failed to load analytics",
        );
      }
    };

    fetchAnalytics();
  }, []);

  const filteredCampaigns = useMemo(() => {
    if (!startDate && !endDate) {
      return campaignAnalytics;
    }

    return campaignAnalytics.filter((campaign) => {
      const dateValue = campaign.sent_date || campaign.scheduled_date;
      if (!dateValue) {
        return true;
      }

      const campaignDate = new Date(dateValue);
      if (startDate && campaignDate < new Date(startDate)) {
        return false;
      }
      if (endDate && campaignDate > new Date(endDate)) {
        return false;
      }

      return true;
    });
  }, [campaignAnalytics, endDate, startDate]);

  const openRate =
    stats.emailsSent > 0
      ? ((stats.opens / stats.emailsSent) * 100).toFixed(1)
      : 0;
  const clickRate =
    stats.emailsSent > 0
      ? ((stats.clicks / stats.emailsSent) * 100).toFixed(1)
      : 0;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 ml-64">
        <Header />

        <main className="p-8 space-y-6">
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  Analytics
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  Campaign performance metrics for admin and marketing users.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-400">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <article className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
                <Send className="h-4 w-4" />
              </div>
              <p className="text-sm text-gray-500">Emails Sent</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {stats.emailsSent.toLocaleString()}
              </p>
            </article>

            <article className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
                <Eye className="h-4 w-4" />
              </div>
              <p className="text-sm text-gray-500">Opens</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {stats.opens.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Open rate: {openRate}%
              </p>
            </article>

            <article className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
                <MousePointer className="h-4 w-4" />
              </div>
              <p className="text-sm text-gray-500">Clicks</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {stats.clicks.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Click rate: {clickRate}%
              </p>
            </article>

            <article className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
                <Users className="h-4 w-4" />
              </div>
              <p className="text-sm text-gray-500">Total Contacts</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {stats.totalContacts.toLocaleString()}
              </p>
            </article>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Campaign Performance
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Campaign
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Subject
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Date
                    </th>
                    <th className="text-center px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Sent
                    </th>
                    <th className="text-center px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Opens
                    </th>
                    <th className="text-center px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Open Rate
                    </th>
                    <th className="text-center px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Click Rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCampaigns.map((campaign) => (
                    <tr
                      key={campaign.campaign_id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {campaign.campaign_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {campaign.campaign_subject}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {campaign.sent_date
                          ? new Date(campaign.sent_date).toLocaleString()
                          : campaign.scheduled_date
                            ? new Date(campaign.scheduled_date).toLocaleString()
                            : "Not scheduled"}
                      </td>
                      <td className="px-6 py-4 text-sm text-center text-gray-900">
                        {campaign.total_sent}
                      </td>
                      <td className="px-6 py-4 text-sm text-center text-gray-900">
                        {campaign.total_opened}
                      </td>
                      <td className="px-6 py-4 text-sm text-center text-gray-700">
                        {campaign.openRate}%
                      </td>
                      <td className="px-6 py-4 text-sm text-center text-gray-700">
                        {campaign.clickRate}%
                      </td>
                    </tr>
                  ))}

                  {filteredCampaigns.length === 0 && (
                    <tr>
                      <td
                        colSpan="7"
                        className="px-6 py-8 text-center text-sm text-gray-500"
                      >
                        No campaign analytics found for the selected range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default Analytics;
