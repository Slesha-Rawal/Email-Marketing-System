import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Eye, MousePointer, Users } from "lucide-react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";

const Analytics = () => {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState("2025-12-01");
  const [endDate, setEndDate] = useState("2025-12-31");

  // Analytics data - replace with actual API call
  const stats = {
    emailsSent: 1250,
    opens: 687,
    clicks: 234,
    totalContacts: 3450,
  };

  // Calculate rates
  const openRate =
    stats.emailsSent > 0
      ? ((stats.opens / stats.emailsSent) * 100).toFixed(1)
      : 0;
  const clickRate =
    stats.emailsSent > 0
      ? ((stats.clicks / stats.emailsSent) * 100).toFixed(1)
      : 0;

  // Campaign analytics data
  const campaignAnalytics = [
    {
      id: 1,
      name: "Christmas 2025 offer",
      subject: "Celebrate Christmas with discounts",
      sendDate: "2025-12-25 09:30 AM",
      sent: 500,
      opens: 250,
      clicks: 65,
      openRate: "50%",
      clickRate: "13%",
    },
    {
      id: 2,
      name: "New Launch",
      subject: "Introducing our new feature",
      sendDate: "2025-12-31 09:30 AM",
      sent: 300,
      opens: 117,
      clicks: 63,
      openRate: "39%",
      clickRate: "21%",
    },
    {
      id: 3,
      name: "New year wish",
      subject: "Happy New Year!!",
      sendDate: "2026-01-01 09:30 AM",
      sent: 450,
      opens: 175,
      clicks: 58,
      openRate: "39%",
      clickRate: "13%",
    },
    {
      id: 4,
      name: "New Launch",
      subject: "Introducing our new product",
      sendDate: "2023-11-02 09:30 AM",
      sent: 200,
      opens: 42,
      clicks: 42,
      openRate: "21%",
      clickRate: "21%",
    },
  ];

  const handleDateFilter = () => {
    // Here you would typically fetch filtered data from API
    console.log("Filtering from", startDate, "to", endDate);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 ml-64">
        <Header />

        <div className="p-8">
          {/* Date Filter Section */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>

            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-gray-500">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleDateFilter}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Emails Sent Card */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-purple-600 rounded-full flex items-center justify-center">
                <Send className="text-white" size={24} />
              </div>
              <h3 className="text-sm text-gray-600 mb-1">Emails Sent</h3>
              <p className="text-3xl font-bold text-gray-900">
                {stats.emailsSent.toLocaleString()}
              </p>
            </div>

            {/* Opens Card */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-green-500 rounded-full flex items-center justify-center">
                <Eye className="text-white" size={24} />
              </div>
              <h3 className="text-sm text-gray-600 mb-1">Opens</h3>
              <p className="text-3xl font-bold text-gray-900">
                {stats.opens.toLocaleString()}
              </p>
              <p className="text-xs text-green-600 font-medium mt-1">
                {openRate}% open rate
              </p>
            </div>

            {/* Clicks Card */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-pink-500 rounded-full flex items-center justify-center">
                <MousePointer className="text-white" size={24} />
              </div>
              <h3 className="text-sm text-gray-600 mb-1">Clicks</h3>
              <p className="text-3xl font-bold text-gray-900">
                {stats.clicks.toLocaleString()}
              </p>
              <p className="text-xs text-pink-600 font-medium mt-1">
                {clickRate}% click rate
              </p>
            </div>

            {/* Total Contacts Card */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-blue-500 rounded-full flex items-center justify-center">
                <Users className="text-white" size={24} />
              </div>
              <h3 className="text-sm text-gray-600 mb-1">Total Contacts</h3>
              <p className="text-3xl font-bold text-gray-900">
                {stats.totalContacts.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Detailed Report */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold mb-6">Detailed Report</h2>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-4 px-4 font-semibold text-gray-700">
                      Campaign Name
                    </th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700">
                      Subject
                    </th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700">
                      Send Date
                    </th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700">
                      Sent
                    </th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700">
                      Opens
                    </th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700">
                      Open Rate
                    </th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700">
                      Click Rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {campaignAnalytics.map((campaign) => (
                    <tr
                      key={campaign.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-4 px-4 font-medium text-gray-900">
                        {campaign.name}
                      </td>
                      <td className="py-4 px-4 text-gray-600">
                        {campaign.subject}
                      </td>
                      <td className="py-4 px-4 text-gray-600">
                        {campaign.sendDate}
                      </td>
                      <td className="py-4 px-4 text-gray-600">
                        {campaign.sent}
                      </td>
                      <td className="py-4 px-4 text-gray-600">
                        {campaign.opens}
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                          {campaign.openRate}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                          {campaign.clickRate}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-center mt-6">
              <button
                onClick={() => navigate("/campaigns")}
                className="text-indigo-600 hover:text-indigo-700 font-medium hover:underline transition-colors"
              >
                View all campaigns →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
