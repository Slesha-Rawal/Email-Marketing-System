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
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Analytics Dashboard
            </h1>
            <p className="text-gray-600">
              Track your email campaign performance and engagement metrics
            </p>
          </div>

          {/* Date Filter Section */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className="w-1 h-8 bg-indigo-600 rounded-full"></div>
              <h2 className="text-xl font-semibold text-gray-800">
                Performance Overview
              </h2>
            </div>

            <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-lg border-2 border-gray-200 shadow-md hover:shadow-lg transition-all duration-200">
              <label className="text-sm font-semibold text-gray-700">
                Period:
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-gray-400"
              />
              <span className="text-gray-400 font-semibold">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-gray-400"
              />
              <button
                onClick={handleDateFilter}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 hover:shadow-lg transition-all duration-200 text-sm font-medium active:scale-95"
              >
                Apply Filter
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {/* Emails Sent Card */}
            <div className="bg-gradient-to-br from-purple-50 to-white p-6 rounded-xl shadow-lg border-2 border-purple-100 hover:shadow-xl hover:scale-105 transition-all duration-300 group">
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300">
                  <Send className="text-white" size={26} />
                </div>
                <div className="text-xs font-semibold text-purple-600 bg-purple-100 px-3 py-1 rounded-full">
                  Total
                </div>
              </div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2">
                Emails Sent
              </h3>
              <p className="text-3xl font-bold text-gray-900 mb-1">
                {stats.emailsSent.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">
                Campaign messages delivered
              </p>
            </div>

            {/* Opens Card */}
            <div className="bg-gradient-to-br from-green-50 to-white p-6 rounded-xl shadow-lg border-2 border-green-100 hover:shadow-xl hover:scale-105 transition-all duration-300 group">
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300">
                  <Eye className="text-white" size={26} />
                </div>
                <div className="text-xs font-semibold text-green-600 bg-green-100 px-3 py-1 rounded-full">
                  {openRate}%
                </div>
              </div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2">
                Opens
              </h3>
              <p className="text-3xl font-bold text-gray-900 mb-1">
                {stats.opens.toLocaleString()}
              </p>
              <p className="text-xs text-green-600 font-semibold">
                {openRate}% open rate
              </p>
            </div>

            {/* Clicks Card */}
            <div className="bg-gradient-to-br from-pink-50 to-white p-6 rounded-xl shadow-lg border-2 border-pink-100 hover:shadow-xl hover:scale-105 transition-all duration-300 group">
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300">
                  <MousePointer className="text-white" size={26} />
                </div>
                <div className="text-xs font-semibold text-pink-600 bg-pink-100 px-3 py-1 rounded-full">
                  {clickRate}%
                </div>
              </div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2">
                Clicks
              </h3>
              <p className="text-3xl font-bold text-gray-900 mb-1">
                {stats.clicks.toLocaleString()}
              </p>
              <p className="text-xs text-pink-600 font-semibold">
                {clickRate}% click rate
              </p>
            </div>

            {/* Total Contacts Card */}
            <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-xl shadow-lg border-2 border-blue-100 hover:shadow-xl hover:scale-105 transition-all duration-300 group">
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300">
                  <Users className="text-white" size={26} />
                </div>
                <div className="text-xs font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                  Active
                </div>
              </div>
              <h3 className="text-sm font-semibold text-gray-600 mb-2">
                Total Contacts
              </h3>
              <p className="text-3xl font-bold text-gray-900 mb-1">
                {stats.totalContacts.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">Total subscribers</p>
            </div>
          </div>

          {/* Detailed Report */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-gray-50 to-white p-6 border-b-2 border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                Campaign Performance Report
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Detailed breakdown of all campaign metrics
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                    <th className="text-left py-4 px-6 font-bold text-gray-700 text-sm uppercase tracking-wide">
                      Campaign Name
                    </th>
                    <th className="text-left py-4 px-6 font-bold text-gray-700 text-sm uppercase tracking-wide">
                      Subject
                    </th>
                    <th className="text-left py-4 px-6 font-bold text-gray-700 text-sm uppercase tracking-wide">
                      Send Date
                    </th>
                    <th className="text-center py-4 px-6 font-bold text-gray-700 text-sm uppercase tracking-wide">
                      Sent
                    </th>
                    <th className="text-center py-4 px-6 font-bold text-gray-700 text-sm uppercase tracking-wide">
                      Opens
                    </th>
                    <th className="text-center py-4 px-6 font-bold text-gray-700 text-sm uppercase tracking-wide">
                      Open Rate
                    </th>
                    <th className="text-center py-4 px-6 font-bold text-gray-700 text-sm uppercase tracking-wide">
                      Click Rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {campaignAnalytics.map((campaign, index) => (
                    <tr
                      key={campaign.id}
                      className={`border-b border-gray-100 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-transparent transition-all duration-200 ${index % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                    >
                      <td className="py-5 px-6 font-semibold text-gray-900">
                        {campaign.name}
                      </td>
                      <td className="py-5 px-6 text-gray-700">
                        {campaign.subject}
                      </td>
                      <td className="py-5 px-6 text-gray-600 text-sm">
                        {campaign.sendDate}
                      </td>
                      <td className="py-5 px-6 text-center">
                        <span className="font-semibold text-gray-900">
                          {campaign.sent}
                        </span>
                      </td>
                      <td className="py-5 px-6 text-center">
                        <span className="font-semibold text-gray-900">
                          {campaign.opens}
                        </span>
                      </td>
                      <td className="py-5 px-6 text-center">
                        <span className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-green-100 to-green-50 text-green-700 rounded-full text-sm font-bold border border-green-200 shadow-sm">
                          {campaign.openRate}
                        </span>
                      </td>
                      <td className="py-5 px-6 text-center">
                        <span className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700 rounded-full text-sm font-bold border border-blue-200 shadow-sm">
                          {campaign.clickRate}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-gradient-to-r from-gray-50 to-white p-6 border-t-2 border-gray-200 text-center">
              <button
                onClick={() => navigate("/campaigns")}
                className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-semibold hover:gap-3 transition-all duration-200 group"
              >
                <span>View all campaigns</span>
                <span className="group-hover:translate-x-1 transition-transform duration-200">
                  →
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
