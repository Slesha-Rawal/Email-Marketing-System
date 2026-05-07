import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Check,
  ChevronDown,
  Copy,
  Mail,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { isUsers } from "../lib/rbac.js";

const Campaigns = ({ mode = "all" }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManageCampaigns = isUsers(user);
  const isDraftOnlyMode = mode === "draft-only";
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(
    isDraftOnlyMode ? "draft" : "",
  );
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [pageError, setPageError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [sendingCampaignId, setSendingCampaignId] = useState(null);
  const [recipientModalCampaign, setRecipientModalCampaign] = useState(null);
  const [recipientModalSearch, setRecipientModalSearch] = useState("");
  const [campaignRecipients, setCampaignRecipients] = useState([]);
  const [campaignRecipientsCount, setCampaignRecipientsCount] = useState(0);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [recipientsError, setRecipientsError] = useState("");
  const [actionModal, setActionModal] = useState({
    type: "",
    campaign: null,
    loading: false,
  });
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

  const pageTitle = isDraftOnlyMode ? "Send Campaign" : "Campaign";
  const pageDescription = isDraftOnlyMode
    ? "Review draft campaigns before sending."
    : canManageCampaigns
      ? "Create, schedule, and monitor your email marketing campaigns."
      : "View and monitor existing campaign statuses.";

  const formatCampaignTimestamp = (value) => {
    if (!value) {
      return "-";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "-";
    }

    return parsed.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const fetchCampaigns = async () => {
    try {
      const response = await api.get("/campaigns");
      setCampaigns(response.data);
      setPageError("");
    } catch (error) {
      console.error("Failed to load campaigns:", error);
      setPageError(
        error?.response?.data?.message || "Failed to load campaigns",
      );
      setCampaigns([]);
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

  const handleDelete = async (campaign) => {
    try {
      await api.delete(`/campaigns/${campaign.campaign_id}`);
      await fetchCampaigns();
      return true;
    } catch (error) {
      console.error("Failed to delete campaign:", error);
      return false;
    }
  };

  const handleSendCampaign = async (campaign) => {
    if (!window.confirm(`Send "${campaign.campaign_name}" now?`)) {
      return;
    }

    setPageError("");
    setSendingCampaignId(campaign.campaign_id);

    try {
      const response = await api.post(
        `/campaigns/${campaign.campaign_id}/send`,
      );
      navigate("/email-logs");
      await fetchCampaigns();
    } catch (error) {
      console.error("Failed to send campaign:", error);
    } finally {
      setSendingCampaignId(null);
    }
  };

  const handleDuplicate = async (campaign) => {
    try {
      const payload = {
        campaign_name: `${campaign.campaign_name} (Copy)`,
        campaign_subject: campaign.campaign_subject,
        campaign_body: campaign.campaign_body,
        template_id: campaign.template_id,
        contact_segment: campaign.contact_segment,
        bcc_segment: campaign.bcc_segment || null,
        campaign_status: "draft",
        scheduled_date: null,
      };

      await api.post("/campaigns", payload);
      await fetchCampaigns();
      return true;
    } catch (error) {
      console.error("Failed to duplicate campaign:", error);
      return false;
    }
  };

  const closeActionModal = () => {
    if (actionModal.loading) {
      return;
    }

    setActionModal({ type: "", campaign: null, loading: false });
  };

  const openActionModal = (type, campaign, event) => {
    event?.stopPropagation();
    setPageError("");
    setActionModal({ type, campaign, loading: false });
  };

  const confirmActionModal = async () => {
    if (!actionModal.campaign || !actionModal.type) {
      return;
    }

    setActionModal((prev) => ({ ...prev, loading: true }));

    let isSuccess = false;
    if (actionModal.type === "delete") {
      isSuccess = await handleDelete(actionModal.campaign);
    } else if (actionModal.type === "duplicate") {
      isSuccess = await handleDuplicate(actionModal.campaign);
    }

    if (isSuccess) {
      setActionModal({ type: "", campaign: null, loading: false });
      return;
    }

    setActionModal((prev) => ({ ...prev, loading: false }));
  };

  const filteredCampaigns = campaigns.filter((campaign) => {
    const isQuickSendCampaign = String(campaign.campaign_name || "")
      .trim()
      .toLowerCase()
      .startsWith("quick send -");

    if (isQuickSendCampaign) {
      return false;
    }

    const matchesSearch =
      campaign.campaign_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      campaign.campaign_subject
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesStatus = isDraftOnlyMode
      ? campaign.campaign_status === "draft"
      : !statusFilter || campaign.campaign_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const hasCampaignFilters =
    Boolean(searchTerm.trim()) || (!isDraftOnlyMode && Boolean(statusFilter));

  const totalCampaigns = filteredCampaigns.length;
  const totalPages = Math.max(1, Math.ceil(totalCampaigns / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCampaigns = filteredCampaigns.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, isDraftOnlyMode]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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
      return "Selected Group";
    }

    if (contactSegment.startsWith("ids:")) {
      return "Selected Contacts";
    }

    return contactSegment;
  };

  const getCampaignRecipientsName = (campaign) => {
    if (campaign.contact_segment?.startsWith("group:")) {
      return campaign.recipient_group_name || "Selected Group";
    }

    return getRecipientsLabel(campaign.contact_segment);
  };

  const getCampaignRecipientsCount = (campaign) => {
    if (campaign.campaign_status === "sent") {
      const snapshotCount = Number(campaign.snapshot_recipient_count);
      if (Number.isFinite(snapshotCount) && snapshotCount > 0) {
        return snapshotCount;
      }

      const persistedTotal = Number(campaign.total_recipients);
      if (Number.isFinite(persistedTotal) && persistedTotal > 0) {
        return persistedTotal;
      }
    }

    const count = Number(campaign.recipient_count_estimate);
    if (Number.isFinite(count)) {
      return count;
    }

    return Number(campaign.total_recipients) || 0;
  };

  const getRecipientInitials = (recipientName = "", recipientEmail = "") => {
    const tokens = String(recipientName || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (tokens.length >= 2) {
      return `${(tokens[0][0] || "").toUpperCase()}${(tokens[tokens.length - 1][0] || "").toUpperCase()}`;
    }

    if (tokens.length === 1 && tokens[0].length >= 2) {
      return tokens[0].slice(0, 2).toUpperCase();
    }

    const localPart = String(recipientEmail || "").split("@")[0] || "";
    return localPart.slice(0, 2).toUpperCase() || "NA";
  };

  const getAvatarTone = (seedValue) => {
    const avatarTones = [
      "bg-indigo-50 text-indigo-700",
      "bg-sky-50 text-sky-700",
      "bg-emerald-50 text-emerald-700",
      "bg-amber-50 text-amber-700",
      "bg-rose-50 text-rose-700",
    ];

    const seed = String(seedValue || "");
    const hash = seed
      .split("")
      .reduce((sum, char) => sum + char.charCodeAt(0), 0);

    return avatarTones[hash % avatarTones.length];
  };
  const getRecipientPreview = (campaign) => {
    if (!Array.isArray(campaign.recipient_preview)) {
      return [];
    }

    return campaign.recipient_preview
      .filter((recipient) => recipient?.recipient_email)
      .map((recipient) => ({
        recipient_name: recipient.recipient_name || "",
        recipient_email: recipient.recipient_email,
        recipient_initials:
          recipient.recipient_initials ||
          getRecipientInitials(
            recipient.recipient_name,
            recipient.recipient_email,
          ),
      }));
  };

  const closeRecipientsModal = () => {
    setRecipientModalCampaign(null);
    setRecipientModalSearch("");
    setCampaignRecipients([]);
    setCampaignRecipientsCount(0);
    setRecipientsError("");
    setRecipientsLoading(false);
  };

  const openRecipientsModal = async (campaign, event) => {
    event?.stopPropagation();

    setRecipientModalCampaign(campaign);
    setRecipientModalSearch("");
    setCampaignRecipients([]);
    setCampaignRecipientsCount(Number(campaign.total_recipients) || 0);
    setRecipientsError("");
    setRecipientsLoading(true);

    try {
      const response = await api.get(
        `/campaigns/${campaign.campaign_id}/recipients`,
      );
      const recipients = Array.isArray(response.data?.recipients)
        ? response.data.recipients
        : [];

      setCampaignRecipients(recipients);
      setCampaignRecipientsCount(
        Number(response.data?.total_recipients) || recipients.length,
      );
    } catch (error) {
      setRecipientsError(
        error.response?.data?.message || "Failed to load recipients",
      );
    } finally {
      setRecipientsLoading(false);
    }
  };

  const filteredModalRecipients = campaignRecipients.filter((recipient) =>
    recipientModalSearch
      ? String(recipient.recipient_email || "")
          .toLowerCase()
          .includes(recipientModalSearch.toLowerCase())
      : true,
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 ml-64 flex flex-col">
        <div className="p-8 max-w-7xl mx-auto w-full">
          <header className="mb-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {pageTitle}
                </h1>
                <p className="mt-1 text-sm text-gray-500">{pageDescription}</p>
              </div>

              {!isDraftOnlyMode && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate("/analytics")}
                    className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-white px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50 transition-colors"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Campaign Analytics
                  </button>

                  {canManageCampaigns && (
                    <button
                      onClick={() => navigate("/create-campaign")}
                      className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all active:scale-[0.98]"
                    >
                      <Plus className="h-4 w-4 stroke-[3px]" />
                      New Campaign
                    </button>
                  )}
                </div>
              )}
            </div>
          </header>

          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 relative rounded-md border border-gray-200 bg-white transition-all focus-within:border-indigo-300">
              <input
                type="text"
                placeholder="Search campaigns..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-md border-none bg-transparent px-3 py-2 pr-10 text-sm text-gray-700 placeholder:text-gray-500 focus:outline-none"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            </div>

            {!isDraftOnlyMode && (
              <div ref={statusMenuRef} className="relative w-44 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsStatusMenuOpen((prev) => !prev)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-700 focus:outline-none focus:border-indigo-300 flex items-center justify-between"
                >
                  <span>{selectedStatusLabel}</span>
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                </button>
                {isStatusMenuOpen && (
                  <div className="absolute z-20 mt-2 w-full rounded-md border border-gray-200 bg-white p-2 shadow-lg">
                    {statusOptions.map((option) => (
                      <button
                        key={option.value || "all"}
                        type="button"
                        onClick={() => {
                          setStatusFilter(option.value);
                          setIsStatusMenuOpen(false);
                        }}
                        className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors flex items-center justify-between ${
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
            )}
          </div>

          {pageError ? (
            <section className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {pageError}
            </section>
          ) : null}

          <div className="bg-white rounded-md border border-gray-200 overflow-hidden shadow-sm">
            {filteredCampaigns.length > 0 ? (
              paginatedCampaigns.map((campaign, index) => (
                <article
                  key={campaign.campaign_id}
                  onClick={() => {
                    if (isDraftOnlyMode) {
                      navigate(`/send-campaign/${campaign.campaign_id}`);
                    } else {
                      navigate(`/create-campaign/${campaign.campaign_id}`);
                    }
                  }}
                  className={`group flex items-start p-6 transition-all relative cursor-pointer ${
                    index !== paginatedCampaigns.length - 1
                      ? "border-b border-gray-100"
                      : ""
                  } ${isDraftOnlyMode ? "hover:bg-indigo-50/30" : "hover:bg-gray-50/50"}`}
                >
                  <div className="w-36 h-36 bg-gray-50 border border-gray-100 shrink-0 overflow-hidden relative group/preview p-3">
                    <iframe
                      srcDoc={`
                        <style>
                          body { margin: 0; padding: 0; font-family: sans-serif; overflow: hidden; background: white;}
                          * { pointer-events: none !important; }
                        </style>
                        ${
                          (campaign.template_id &&
                          campaign.template_body != null
                            ? campaign.template_body
                            : campaign.campaign_body) ||
                          "<div style='color:#cbd5e1;text-align:center;padding-top:40px;font-size:16px;'>No Preview</div>"
                        }
                      `}
                      className="w-200 h-200 pointer-events-none origin-top-left scale-[0.15] border-none"
                      title="Preview"
                    />
                  </div>

                  <div className="flex-1 min-w-0 ml-6 flex flex-col items-start pt-1.5">
                    <h4 className="text-lg font-semibold text-gray-900 truncate mb-1">
                      {campaign.campaign_name}
                    </h4>
                    <div className="mb-4 mt-0.5 space-y-1">
                      <p className="text-xs text-gray-400">
                        Last updated at:{" "}
                        <span className="text-gray-500 font-medium">
                          {formatCampaignTimestamp(campaign.updated_at)}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400">
                        Last updated by:{" "}
                        <span className="text-gray-500 font-medium">
                          {campaign.updated_by || "-"}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400">
                        Recipients:{" "}
                        <span className="text-gray-500 font-medium">
                          {getCampaignRecipientsName(campaign)}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400">
                        Recipients:{" "}
                        <button
                          type="button"
                          onClick={(event) =>
                            openRecipientsModal(campaign, event)
                          }
                          className="inline-flex items-center gap-1.5 text-left"
                          title="View recipients"
                        >
                          {(() => {
                            const previewRecipients =
                              getRecipientPreview(campaign);
                            const maxVisible = 4;
                            const visibleRecipients = previewRecipients.slice(
                              0,
                              maxVisible,
                            );
                            const extraCount = Math.max(
                              0,
                              getCampaignRecipientsCount(campaign) -
                                visibleRecipients.length,
                            );

                            if (
                              visibleRecipients.length === 0 &&
                              getCampaignRecipientsCount(campaign) === 0
                            ) {
                              return (
                                <span className="text-gray-500 font-medium">
                                  -
                                </span>
                              );
                            }

                            return (
                              <>
                                {visibleRecipients.map(
                                  (recipient, recipientIndex) => (
                                    <span
                                      key={`${recipient.recipient_email}-${recipientIndex}`}
                                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${getAvatarTone(
                                        recipient.recipient_email ||
                                          recipient.recipient_name,
                                      )}`}
                                    >
                                      {getRecipientInitials(
                                        recipient.recipient_name,
                                        recipient.recipient_email,
                                      )}
                                    </span>
                                  ),
                                )}
                                {extraCount > 0 && (
                                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-100 px-1 text-[9px] font-semibold text-gray-600">
                                    +{extraCount}
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </button>
                      </p>
                    </div>
                  </div>

                  <div className="ml-4 self-stretch flex flex-col items-end justify-between py-1.5">
                    {!isDraftOnlyMode && canManageCampaigns && (
                      <div className="flex items-center gap-0.5 opacity-100 transition-opacity">
                        <button
                          onClick={(event) =>
                            openActionModal("duplicate", campaign, event)
                          }
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all"
                          title="Duplicate"
                        >
                          <Copy size={16} />
                        </button>

                        {campaign.campaign_status !== "sent" && (
                          <button
                            onClick={(event) =>
                              openActionModal("delete", campaign, event)
                            }
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    )}

                    <span
                      className={`px-3 py-1.5 rounded-full text-xs font-bold inline-block h-fit w-fit ${
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
                </article>
              ))
            ) : hasCampaignFilters ? (
              <div className="px-6 py-12 text-center text-sm text-gray-500">
                No campaigns found.
              </div>
            ) : (
              <div className="py-24 text-center">
                <div className="w-16 h-16 bg-indigo-50 rounded-lg flex items-center justify-center mx-auto mb-6">
                  <Mail className="h-8 w-8 text-indigo-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  Your Outbox is Empty
                </h3>
                <p className="text-gray-500 max-w-xs mx-auto mt-2 text-xs">
                  Create your first campaign today.
                </p>
                {canManageCampaigns && (
                  <button
                    onClick={() => navigate("/create-campaign")}
                    className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"
                  >
                    <Plus className="h-4 w-4 stroke-[3px]" />
                    Start Growing
                  </button>
                )}
              </div>
            )}

            {filteredCampaigns.length > 0 && (
              <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-2 text-sm">
                <div className="text-gray-500">
                  Showing {startIndex + 1}-{Math.min(endIndex, totalCampaigns)}{" "}
                  of {totalCampaigns}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage === 1}
                    className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300"
                  >
                    &lt;
                  </button>

                  <span className="text-gray-600">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300"
                  >
                    &gt;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {recipientModalCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-md border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Recipients
                </h3>
                <p className="text-xs text-gray-500">
                  {recipientModalCampaign.campaign_name} (
                  {campaignRecipientsCount})
                </p>
              </div>
              <button
                type="button"
                onClick={closeRecipientsModal}
                className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4">
              <div className="relative rounded-md border border-gray-200 bg-white transition-all focus-within:border-indigo-300">
                <input
                  type="text"
                  placeholder="Search by email"
                  value={recipientModalSearch}
                  onChange={(event) =>
                    setRecipientModalSearch(event.target.value)
                  }
                  className="w-full rounded-md border-none bg-transparent px-3 py-2 pr-10 text-sm text-gray-700 placeholder:text-gray-500 focus:outline-none"
                />
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto border-t border-gray-100 px-5 py-3">
              {recipientsLoading ? (
                <p className="py-6 text-sm text-gray-500">
                  Loading recipients...
                </p>
              ) : recipientsError ? (
                <p className="py-6 text-sm text-red-600">{recipientsError}</p>
              ) : filteredModalRecipients.length === 0 ? (
                <p className="py-6 text-sm text-gray-500">
                  No recipients found.
                </p>
              ) : (
                <ul className="space-y-2">
                  {filteredModalRecipients.map((recipient, index) => (
                    <li
                      key={`${recipient.recipient_email}-${index}`}
                      className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold ${getAvatarTone(
                            recipient.recipient_email ||
                              recipient.recipient_name,
                          )}`}
                        >
                          {getRecipientInitials(
                            recipient.recipient_name,
                            recipient.recipient_email,
                          )}
                        </span>
                        <span className="text-sm text-gray-800">
                          {recipient.recipient_name || "Unknown"}
                        </span>
                      </div>
                      <span className="text-sm text-gray-600">
                        {recipient.recipient_email}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {actionModal.campaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-md border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h3 className="text-base font-semibold text-gray-900">
                {actionModal.type === "delete"
                  ? "Delete Campaign"
                  : "Duplicate Campaign"}
              </h3>
            </div>

            <div className="px-5 py-4">
              <p className="text-sm text-gray-600">
                {actionModal.type === "delete"
                  ? `Are you sure you want to delete "${actionModal.campaign.campaign_name}"? This cannot be undone.`
                  : `Duplicate "${actionModal.campaign.campaign_name}" as a new draft campaign?`}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4">
              <button
                type="button"
                onClick={closeActionModal}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                disabled={actionModal.loading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmActionModal}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  actionModal.type === "delete"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
                disabled={actionModal.loading}
              >
                {actionModal.loading
                  ? actionModal.type === "delete"
                    ? "Deleting..."
                    : "Duplicating..."
                  : actionModal.type === "delete"
                    ? "Delete"
                    : "Duplicate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Campaigns;
