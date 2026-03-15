import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Edit2, Plus, Search, Send, Trash2 } from "lucide-react";
import Header from "../components/Header.jsx";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const Campaigns = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManageCampaigns = user?.role === "marketing";
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [campaigns, setCampaigns] = useState([]);
  const [pageError, setPageError] = useState("");
  const [pageMessage, setPageMessage] = useState("");
  const [sendingCampaignId, setSendingCampaignId] = useState(null);

  const fetchCampaigns = async () => {
    try {
      const response = await api.get("/campaigns");
      setCampaigns(response.data);
      setPageError("");
    } catch (error) {
      setPageError(error.response?.data?.message || "Failed to load campaigns");
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this campaign?")) {
      return;
    }

    try {
      await api.delete(`/campaigns/${id}`);
      fetchCampaigns();
    } catch (error) {
      setPageError(
        error.response?.data?.message || "Failed to delete campaign",
      );
    }
  };

  const handleSendCampaign = async (campaign) => {
    if (!window.confirm(`Send \"${campaign.campaign_name}\" now?`)) {
      return;
    }

    setPageError("");
    setPageMessage("");
    setSendingCampaignId(campaign.campaign_id);

    try {
      const response = await api.post(
        `/campaigns/${campaign.campaign_id}/send`,
      );
      setPageMessage(response.data?.message || "Campaign sent successfully");
      await fetchCampaigns();
    } catch (error) {
      setPageError(error.response?.data?.message || "Failed to send campaign");
    } finally {
      setSendingCampaignId(null);
    }
  };

  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch =
      campaign.campaign_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      campaign.campaign_subject
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesStatus =
      !statusFilter || campaign.campaign_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 ml-64">
        <Header />

        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Campaigns</h1>
              <p className="text-sm text-gray-500 mt-1">
                {canManageCampaigns
                  ? "Marketing users can create, schedule, and update campaigns."
                  : "Admins can monitor campaign activity only."}
              </p>
            </div>
            {canManageCampaigns && (
              <button
                onClick={() => navigate("/create-campaign")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Create campaign
              </button>
            )}
          </div>

          {pageError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {pageError}
            </div>
          )}

          {pageMessage && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {pageMessage}
            </div>
          )}

          <div className="mb-6 bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="text"
                  placeholder="Search campaigns"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">All Status</option>
                <option value="sent">sent</option>
                <option value="scheduled">scheduled</option>
                <option value="draft">draft</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
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
                      Status
                    </th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700">
                      Schedule
                    </th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCampaigns.length > 0 ? (
                    filteredCampaigns.map((campaign) => (
                      <tr
                        key={campaign.campaign_id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-4 px-4 font-medium text-gray-900">
                          {campaign.campaign_name}
                        </td>
                        <td className="py-4 px-4 text-gray-600">
                          {campaign.campaign_subject}
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-medium ${
                              campaign.campaign_status === "sent"
                                ? "bg-green-100 text-green-700"
                                : campaign.campaign_status === "scheduled"
                                  ? "bg-indigo-100 text-indigo-700"
                                  : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {campaign.campaign_status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-gray-600">
                          {campaign.scheduled_date
                            ? new Date(campaign.scheduled_date).toLocaleString()
                            : "Send now"}
                        </td>
                        <td className="py-4 px-4">
                          {canManageCampaigns ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSendCampaign(campaign)}
                                disabled={
                                  sendingCampaignId === campaign.campaign_id
                                }
                                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                                title="Send now"
                              >
                                <Send size={14} />
                                {sendingCampaignId === campaign.campaign_id
                                  ? "Sending..."
                                  : "Send"}
                              </button>
                              <button
                                onClick={() =>
                                  navigate("/create-campaign", {
                                    state: { campaign },
                                  })
                                }
                                className="p-2 hover:bg-gray-100 rounded transition-colors"
                                title="Edit"
                              >
                                <Edit2 size={18} className="text-gray-600" />
                              </button>
                              <button
                                onClick={() =>
                                  handleDelete(campaign.campaign_id)
                                }
                                className="p-2 hover:bg-gray-100 rounded transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={18} className="text-gray-600" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">
                              View only
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="5"
                        className="py-8 text-center text-gray-500"
                      >
                        No campaigns found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Campaigns;
