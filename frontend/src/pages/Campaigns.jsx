import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  ChevronDown,
  Copy,
  Edit2,
  Mail,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const Campaigns = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManageCampaigns = user?.role === "marketing";
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [pageError, setPageError] = useState("");
  const [pageMessage, setPageMessage] = useState("");
  const [sendingCampaignId, setSendingCampaignId] = useState(null);
  const statusMenuRef = useRef(null);

  const statusOptions = [
    { value: "", label: "Every status" },
    { value: "sent", label: "Sent" },
    { value: "scheduled", label: "Scheduled" },
    { value: "draft", label: "Draft" },
  ];

  const selectedStatusLabel =
    statusOptions.find((option) => option.value === statusFilter)?.label ||
    "Every status";

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

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (
        statusMenuRef.current &&
        !statusMenuRef.current.contains(event.target)
      ) {
        setIsStatusMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentClick);
    return () => document.removeEventListener("mousedown", handleDocumentClick);
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
    if (!window.confirm(`Send "${campaign.campaign_name}" now?`)) {
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
      navigate("/email-logs");
      await fetchCampaigns();
    } catch (error) {
      setPageError(error.response?.data?.message || "Failed to send campaign");
    } finally {
      setSendingCampaignId(null);
    }
  };

  const handleDuplicate = async (campaign) => {
    if (!window.confirm(`Duplicate "${campaign.campaign_name}"?`)) {
      return;
    }

    try {
      const payload = {
        campaign_name: `${campaign.campaign_name} (Copy)`,
        campaign_subject: campaign.campaign_subject,
        campaign_body: campaign.campaign_body,
        template_id: campaign.template_id,
        sender_name: campaign.sender_name,
        sender_email: campaign.sender_email,
        reply_to_email: campaign.reply_to_email,
        contact_segment: campaign.contact_segment,
        campaign_status: "draft",
        scheduled_date: null,
      };

      await api.post("/campaigns", payload);
      fetchCampaigns();
      setPageMessage("Campaign duplicated successfully");
    } catch (error) {
      setPageError(
        error.response?.data?.message || "Failed to duplicate campaign",
      );
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

  const getRecipientsLabel = (contactSegment) => {
    if (!contactSegment || contactSegment === "all") {
      return "All Contacts";
    }

    if (contactSegment === "active") {
      return "Active Contacts";
    }

    if (contactSegment === "unsubscribed") {
      return "Unsubscribed Contacts";
    }

    if (contactSegment.startsWith("group:")) {
      const groupId = contactSegment.replace("group:", "");
      return groupId ? `Group (${groupId})` : "Selected Group";
    }

    if (contactSegment.startsWith("ids:")) {
      return "Selected Contacts";
    }

    return contactSegment;
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 ml-64 flex flex-col">
        <div className="p-8 max-w-7xl mx-auto w-full">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Campaign</h1>
            <p className="mt-1 text-sm text-gray-500">
              {canManageCampaigns
                ? "Create, schedule, and monitor your email marketing campaigns."
                : "View and monitor existing campaign statuses."}
            </p>
          </header>

          <div className="flex items-center justify-between mb-8 gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="flex-1 max-w-sm">
                <div className="relative rounded-lg border border-gray-200 bg-white transition-all focus-within:border-indigo-300">
                  <input
                    type="text"
                    placeholder="Search campaigns..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="w-full rounded-lg border-none bg-transparent px-3 py-2.5 pr-10 text-sm text-gray-700 placeholder:text-gray-500 focus:outline-none"
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                </div>
              </div>

              <div ref={statusMenuRef} className="relative w-44 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsStatusMenuOpen((prev) => !prev)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left text-sm text-gray-700 focus:outline-none focus:border-indigo-300 flex items-center justify-between"
                >
                  <span>{selectedStatusLabel}</span>
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                </button>

                {isStatusMenuOpen && (
                  <div className="absolute z-20 mt-2 w-full rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                    {statusOptions.map((option) => (
                      <button
                        key={option.value || "all"}
                        type="button"
                        onClick={() => {
                          setStatusFilter(option.value);
                          setIsStatusMenuOpen(false);
                        }}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors flex items-center justify-between ${
                          statusFilter === option.value
                            ? "bg-indigo-50 text-indigo-700"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <span>{option.label}</span>
                        {statusFilter === option.value && (
                          <Check className="h-4 w-4" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {canManageCampaigns && (
              <button
                onClick={() => navigate("/create-campaign")}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all active:scale-[0.98]"
              >
                <Plus className="h-4 w-4 stroke-[3px]" />
                New Campaign
              </button>
            )}
          </div>

          {(pageError || pageMessage) && (
            <div
              className={`mb-8 rounded-lg border p-4 text-sm font-medium animate-in fade-in slide-in-from-top-2 ${
                pageError
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-green-200 bg-green-50 text-green-700"
              }`}
            >
              {pageError || pageMessage}
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            {filteredCampaigns.length > 0 ? (
              filteredCampaigns.map((campaign, index) => (
                <article
                  key={campaign.campaign_id}
                  className={`group flex items-start p-6 hover:bg-gray-50/50 transition-all relative ${
                    index !== filteredCampaigns.length - 1
                      ? "border-b border-gray-100"
                      : ""
                  }`}
                >
                  <div className="w-36 h-36 bg-gray-50 border border-gray-100 shrink-0 overflow-hidden relative group/preview p-3">
                    <iframe
                      srcDoc={`
                        <style>
                          body { margin: 0; padding: 0; font-family: sans-serif; overflow: hidden; background: white;}
                          * { pointer-events: none !important; }
                        </style>
                        ${campaign.campaign_body || "<div style='color:#cbd5e1;text-align:center;padding-top:40px;font-size:16px;'>No Preview</div>"}
                      `}
                      className="w-200 h-200 pointer-events-none origin-top-left scale-[0.15] border-none"
                      title="Preview"
                    />
                  </div>

                  {/* Info Column */}
                  <div className="flex-1 min-w-0 ml-6 flex flex-col items-start pt-1.5">
                    <h4 className="text-lg font-semibold text-gray-900 truncate mb-1">
                      {campaign.campaign_name}
                    </h4>
                    <div className="mb-4 mt-0.5">
                      <p className="text-xs text-gray-400">
                        Created At:{" "}
                        <span className="text-gray-500 font-medium">
                          {new Date(campaign.created_at).toLocaleDateString(
                            "en-US",
                            { day: "numeric", month: "short", year: "numeric" },
                          )}
                        </span>
                      </p>
                      <div className="flex flex-col gap-0.5 mt-1">
                        <p className="text-xs text-gray-400">
                          Recipients Count:{" "}
                          <span className="text-gray-500 font-medium">
                            {campaign.recipients_count !== undefined
                              ? campaign.recipients_count
                              : "-"}
                          </span>
                        </p>
                        <p className="text-xs text-gray-400">
                          Recipients:{" "}
                          <span className="text-gray-500 font-medium">
                            {getRecipientsLabel(campaign.contact_segment)}
                          </span>
                        </p>
                        <p className="text-xs text-gray-400">
                          Created By:{" "}
                          <span className="text-gray-500 font-medium">
                            {campaign.created_by || "-"}
                          </span>
                        </p>
                        <p className="text-xs text-gray-400">
                          Status:{" "}
                          <span className="text-gray-500 font-medium">
                            {campaign.campaign_status
                              ? campaign.campaign_status
                                  .charAt(0)
                                  .toUpperCase() +
                                campaign.campaign_status.slice(1)
                              : "-"}
                          </span>
                        </p>
                      </div>
                    </div>
                    <span
                      className={`mt-2 px-3 py-1.5 rounded-full text-xs font-bold inline-block h-fit w-fit ${
                        campaign.campaign_status === "sent"
                          ? "bg-emerald-100 text-emerald-700"
                          : campaign.campaign_status === "scheduled"
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {campaign.campaign_status.charAt(0).toUpperCase() +
                        campaign.campaign_status.slice(1)}
                    </span>
                  </div>

                  {/* Top-Right Action Icons */}
                  <div className="absolute top-4 right-4 flex items-center gap-0.5 opacity-100 transition-opacity">
                    <button
                      onClick={() =>
                        navigate("/create-campaign", { state: { campaign } })
                      }
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>

                    <button
                      onClick={() => handleDuplicate(campaign)}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      title="Duplicate"
                    >
                      <Copy size={16} />
                    </button>

                    <button
                      onClick={() => handleDelete(campaign.campaign_id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="py-24 text-center">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Mail className="h-8 w-8 text-indigo-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  Your Outbox is Empty
                </h3>
                <p className="text-gray-500 max-w-xs mx-auto mt-2 text-xs">
                  Create your first campaign today.
                </p>
                <button
                  onClick={() => navigate("/create-campaign")}
                  className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"
                >
                  <Plus className="h-4 w-4 stroke-[3px]" />
                  Start Growing
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Campaigns;
