import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const MIN_PREVIEW_HEIGHT = 240;
const MAX_PREVIEW_HEIGHT = 1400;

const hasUnsubscribeMarkup = (html = "") =>
  /(\{\{\s*unsubscribe_url\s*\}\}|\/unsubscribe\b|>\s*unsubscribe\s*<)/i.test(
    String(html || ""),
  );

const SendCampaignDetails = () => {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [campaign, setCampaign] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [bccContactIds, setBccContactIds] = useState([]);
  const [showBccField, setShowBccField] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [bccSearchQuery, setBccSearchQuery] = useState("");
  const [isRecipientsDropdownOpen, setIsRecipientsDropdownOpen] =
    useState(false);
  const [isBccDropdownOpen, setIsBccDropdownOpen] = useState(false);
  const [showAllInPreview, setShowAllInPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });

  const recipientsDropdownRef = useRef(null);
  const bccDropdownRef = useRef(null);
  const previewViewportRef = useRef(null);
  const previewIframeRef = useRef(null);
  const [iframeHeight, setIframeHeight] = useState(500);
  const [iframeScale, setIframeScale] = useState(1);
  const [iframeContentHeight, setIframeContentHeight] = useState(500);
  const [iframeContentWidth, setIframeContentWidth] = useState(700);

  // Fetch campaign and contacts
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [campaignRes, contactsRes] = await Promise.all([
          api.get(`/campaigns/${campaignId}`),
          api.get("/contacts"),
        ]);

        setCampaign(campaignRes.data);
        setContacts(contactsRes.data);

        const contactRows = Array.isArray(contactsRes.data)
          ? contactsRes.data
          : [];

        const resolveIdsFromRecipients = (recipients = []) => {
          const contactIdSet = new Set(contactRows.map((c) => c.contact_id));
          const emailToId = new Map(
            contactRows.map((c) => [
              String(c.contact_email || "")
                .trim()
                .toLowerCase(),
              c.contact_id,
            ]),
          );

          return recipients
            .map((recipient) => {
              const recipientId = Number.parseInt(recipient.contact_id, 10);

              if (!Number.isNaN(recipientId) && contactIdSet.has(recipientId)) {
                return recipientId;
              }

              const normalizedEmail = String(recipient.recipient_email || "")
                .trim()
                .toLowerCase();
              return emailToId.get(normalizedEmail) || null;
            })
            .filter((id) => Number.isInteger(id));
        };

        const parseSegmentIds = (segmentValue = "") => {
          const normalizedSegment = String(segmentValue || "")
            .trim()
            .toLowerCase();

          if (!normalizedSegment.startsWith("ids:")) {
            return [];
          }

          return normalizedSegment
            .replace("ids:", "")
            .split(",")
            .map((id) => Number.parseInt(id.trim(), 10))
            .filter((id) => Number.isInteger(id));
        };

        // Always try canonical backend recipient resolution first.
        let prefilledToIds = [];
        let prefilledBccIds = [];

        try {
          const recipientsRes = await api.get(
            `/campaigns/${campaignId}/recipients`,
          );
          const recipients = Array.isArray(recipientsRes.data?.recipients)
            ? recipientsRes.data.recipients
            : [];

          const typedRecipients = recipients.filter(
            (recipient) => recipient && recipient.recipient_type,
          );

          if (typedRecipients.length > 0) {
            const toRecipients = typedRecipients.filter(
              (recipient) =>
                String(recipient.recipient_type || "to").toLowerCase() !==
                "bcc",
            );
            const bccRecipients = typedRecipients.filter(
              (recipient) =>
                String(recipient.recipient_type || "to").toLowerCase() ===
                "bcc",
            );

            prefilledToIds = resolveIdsFromRecipients(toRecipients);
            prefilledBccIds = resolveIdsFromRecipients(bccRecipients);

            // Backfill BCC ids from campaign.bcc_segment when the
            // recipient snapshots contain only 'to' typed recipients
            // (some snapshots may not include recipient_type for BCC).
            if (
              prefilledBccIds.length === 0 &&
              campaignRes.data &&
              campaignRes.data.bcc_segment
            ) {
              const fallbackBccIds = parseSegmentIds(
                campaignRes.data.bcc_segment,
              );
              if (fallbackBccIds.length > 0) {
                prefilledBccIds = Array.from(
                  new Set([...prefilledBccIds, ...fallbackBccIds]),
                );
              }
            }
          } else {
            prefilledToIds = resolveIdsFromRecipients(recipients);
          }
        } catch {
          // Fallback below handles legacy/local parsing.
        }

        if (prefilledToIds.length > 0 || prefilledBccIds.length > 0) {
          setSelectedContactIds([...new Set(prefilledToIds)]);
          setBccContactIds([...new Set(prefilledBccIds)]);
          setShowBccField(prefilledBccIds.length > 0);
          return;
        }

        // Fallback: parse contact segment locally when recipient API returns no rows.
        const rawSegment = String(campaignRes.data.contact_segment || "")
          .trim()
          .toLowerCase();

        if (
          !rawSegment ||
          rawSegment === "all" ||
          rawSegment === "active" ||
          rawSegment === "all contacts" ||
          rawSegment === "active contacts"
        ) {
          setSelectedContactIds(
            contactRows
              .filter((c) => c.contact_status === "active")
              .map((c) => c.contact_id),
          );
          return;
        }

        if (rawSegment === "unsubscribed") {
          setSelectedContactIds(
            contactRows
              .filter((c) => c.contact_status === "unsubscribed")
              .map((c) => c.contact_id),
          );
          return;
        }

        if (rawSegment.startsWith("group:")) {
          const groupId = Number.parseInt(rawSegment.split(":")[1], 10);
          setSelectedContactIds(
            contactRows
              .filter((c) => c.contact_group_id === groupId)
              .map((c) => c.contact_id),
          );
          return;
        }

        if (rawSegment.startsWith("ids:")) {
          const ids = parseSegmentIds(rawSegment);
          setSelectedContactIds(ids);

          const fallbackBccIds = parseSegmentIds(campaignRes.data.bcc_segment);
          setBccContactIds(fallbackBccIds);
          setShowBccField(fallbackBccIds.length > 0);
          return;
        }

        setSelectedContactIds([]);
        const fallbackBccIds = parseSegmentIds(campaignRes.data.bcc_segment);
        setBccContactIds(fallbackBccIds);
        setShowBccField(fallbackBccIds.length > 0);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load campaign");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [campaignId]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        recipientsDropdownRef.current &&
        !recipientsDropdownRef.current.contains(event.target)
      ) {
        setIsRecipientsDropdownOpen(false);
      }

      if (
        bccDropdownRef.current &&
        !bccDropdownRef.current.contains(event.target)
      ) {
        setIsBccDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const filteredContacts = contacts.filter((contact) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      contact.contact_name?.toLowerCase().includes(q) ||
      contact.contact_email?.toLowerCase().includes(q)
    );
  });

  const filteredBccContacts = contacts.filter((contact) => {
    if (!bccSearchQuery) return true;
    const query = bccSearchQuery.toLowerCase();
    return (
      contact.contact_name?.toLowerCase().includes(query) ||
      contact.contact_email?.toLowerCase().includes(query)
    );
  });

  const selectedContacts = contacts.filter((contact) =>
    selectedContactIds.includes(contact.contact_id),
  );
  const previewContacts = showAllInPreview
    ? selectedContacts
    : selectedContacts.slice(0, 5);

  const toggleContact = (contactId) => {
    setSelectedContactIds((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId],
    );
  };

  const toggleBccContact = (contactId) => {
    setBccContactIds((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId],
    );
  };

  const updatePreviewLayout = () => {
    const iframe = previewIframeRef.current;
    const viewport = previewViewportRef.current;

    if (!iframe || !viewport || !iframe.contentWindow) {
      return;
    }

    try {
      const doc = iframe.contentWindow.document;
      const bodyHeight = Math.max(
        doc.body?.scrollHeight || 0,
        Math.ceil(doc.body?.getBoundingClientRect?.().height || 0),
      );
      const htmlHeight = Math.max(
        doc.documentElement?.scrollHeight || 0,
        Math.ceil(doc.documentElement?.getBoundingClientRect?.().height || 0),
      );

      // Prefer body-based sizing and only trust html height when it is close.
      let contentHeight = Math.max(bodyHeight, MIN_PREVIEW_HEIGHT);
      if (htmlHeight > 0 && htmlHeight <= contentHeight * 1.25) {
        contentHeight = Math.max(contentHeight, htmlHeight);
      }

      const contentWidth = Math.max(
        doc.body?.scrollWidth || 0,
        doc.documentElement?.scrollWidth || 0,
      );

      if (!contentHeight || !contentWidth) {
        return;
      }

      const viewportWidth = viewport.clientWidth || contentWidth;
      const nextScale = Math.min(1, viewportWidth / contentWidth);

      setIframeScale(nextScale);
      setIframeContentHeight(contentHeight);
      setIframeContentWidth(contentWidth);
      const scaledHeight = Math.max(
        MIN_PREVIEW_HEIGHT,
        Math.ceil(contentHeight * nextScale),
      );
      setIframeHeight(Math.min(MAX_PREVIEW_HEIGHT, scaledHeight));
    } catch (err) {
      console.error("Error updating preview layout:", err);
    }
  };

  const handleIframeLoad = (event) => {
    previewIframeRef.current = event.target;
    setTimeout(updatePreviewLayout, 100);
    setTimeout(updatePreviewLayout, 360);
  };

  useEffect(() => {
    const timers = [80, 220, 420].map((delay) =>
      setTimeout(updatePreviewLayout, delay),
    );
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [campaign?.campaign_body, campaign?.template_body, campaign?.template_id]);

  useEffect(() => {
    const handleResize = () => updatePreviewLayout();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const viewport = previewViewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(() => updatePreviewLayout());
    });

    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const applyPreviewMergeTags = (content = "") =>
    String(content || "").replace(
      /\{\{\s*unsubscribe_url\s*\}\}/gi,
      "/unsubscribe",
    );

  const getPreviewHtml = () => {
    if (!campaign) return "";

    const previewBody =
      campaign.template_id && campaign.template_body != null
        ? campaign.template_body
        : campaign.campaign_body;

    const previewContent = applyPreviewMergeTags(previewBody || "");

    const ensureViewportMeta = (html) => {
      if (/<meta\s+name=["']viewport["']/i.test(html)) {
        return html;
      }
      if (/<head[^>]*>/i.test(html)) {
        return html.replace(
          /<head[^>]*>/i,
          (match) =>
            `${match}\n<meta name="viewport" content="width=device-width, initial-scale=1" />`,
        );
      }
      return html;
    };

    const unsubscribeFooter = `
      <p style="margin:24px 0 0 0;text-align:center;font-size:12px;line-height:1.5;color:#9ca3af;font-family:sans-serif;">
        You are receiving these emails because you are subscribed to our email updates.<br/>
        <a href='/unsubscribe' style="color:#6366f1;text-decoration:underline;" target="_blank">Unsubscribe</a>
      </p>
    `;
    const shouldAddFooter = !hasUnsubscribeMarkup(previewContent);

    if (!previewContent) {
      return `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <style>
              body { margin: 0; padding: 0; font-family: sans-serif; font-size: 13px; color: #222; }
            </style>
          </head>
          <body>${shouldAddFooter ? unsubscribeFooter : ""}</body>
        </html>
      `;
    }

    const trimmed = previewContent.trim().toLowerCase();
    if (trimmed.startsWith("<!doctype") || trimmed.startsWith("<html")) {
      if (/<\/body>/i.test(previewContent)) {
        if (!shouldAddFooter) {
          return ensureViewportMeta(previewContent);
        }
        return ensureViewportMeta(
          previewContent.replace(/<\/body>/i, `${unsubscribeFooter}</body>`),
        );
      }
      return ensureViewportMeta(
        shouldAddFooter
          ? `${previewContent}${unsubscribeFooter}`
          : previewContent,
      );
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            body { margin: 0; padding: 0; font-family: sans-serif; font-size: 13px; color: #222; }
            * { box-sizing: border-box; }
            img { max-width: 100%; height: auto; }
            a img { display: inline-block; vertical-align: middle; }
            .preview-content * { font-size: 13px !important; }
            .preview-content { font-size: 13px !important; }
            a { color: #6366f1; }
          </style>
        </head>
        <body>
          <div class="preview-content">${previewContent}</div>
          ${shouldAddFooter ? unsubscribeFooter : ""}
        </body>
      </html>
    `;
  };

  const handleSend = async () => {
    if (selectedContactIds.length === 0) {
      setStatus({
        type: "error",
        message: "Please select at least one recipient",
      });
      return;
    }

    if (!window.confirm("Send this campaign now?")) {
      return;
    }

    try {
      setLoading(true);
      await api.post(`/campaigns/${campaignId}/send-draft`, {
        selectedContactIds,
        bccContactIds: showBccField ? bccContactIds : [],
      });
      setStatus({
        type: "success",
        message: "Campaign sent successfully!",
      });
      setTimeout(() => navigate("/send-campaign"), 2000);
    } catch (err) {
      setStatus({
        type: "error",
        message: err.response?.data?.message || "Failed to send campaign",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading && !campaign) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 ml-64 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading campaign...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 ml-64 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600">{error || "Campaign not found"}</p>
            <button
              onClick={() => navigate("/send-campaign")}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <ArrowLeft size={18} />
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 font-sans">
      <Sidebar />

      <div className="flex-1 ml-64 overflow-y-auto">
        <main className="p-6 lg:p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              Send Campaign
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Configure your options and preview your campaign before sending.
            </p>
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-5 items-start">
            <div className="bg-white rounded-md border border-gray-200 p-4 lg:p-5 space-y-5">
              <div className="space-y-5">
                {/* Campaign Name (Display Only) */}
                <div>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-gray-700">
                      Campaign Name :
                    </span>{" "}
                    {campaign?.campaign_name}
                  </p>
                </div>

                {/* Select Recipients */}
                <div className="relative" ref={recipientsDropdownRef}>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    To
                  </label>
                  <div
                    className={`min-h-11 relative rounded-md border bg-white transition-all px-2.5 py-2 flex flex-wrap items-center gap-2 pr-10 ${
                      selectedContactIds.length === 0
                        ? "border-gray-200 focus-within:border-indigo-300"
                        : "border-indigo-200 bg-indigo-50"
                    }`}
                    onClick={() => {
                      setIsRecipientsDropdownOpen(true);
                      document.getElementById("contact-search-input")?.focus();
                    }}
                  >
                    {selectedContactIds.map((id) => {
                      const contact = contacts.find((c) => c.contact_id === id);
                      if (!contact) return null;
                      return (
                        <div
                          key={contact.contact_id}
                          className="inline-flex items-center gap-1.5 rounded-md border border-indigo-100 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700"
                        >
                          <span className="truncate max-w-35">
                            {contact.contact_email}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleContact(contact.contact_id);
                            }}
                            className="text-indigo-400 hover:text-indigo-700"
                          >
                            x
                          </button>
                        </div>
                      );
                    })}

                    <input
                      id="contact-search-input"
                      type="text"
                      placeholder={
                        selectedContactIds.length === 0
                          ? "Type name or email address..."
                          : ""
                      }
                      className="flex-1 min-w-30 bg-transparent border-none p-0 h-7 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
                      value={searchQuery}
                      onFocus={() => setIsRecipientsDropdownOpen(true)}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setIsRecipientsDropdownOpen(true);
                      }}
                    />

                    {selectedContactIds.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedContactIds([]);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                        title="Clear all recipients"
                      >
                        ×
                      </button>
                    )}

                    {isRecipientsDropdownOpen && (
                      <div className="absolute z-40 top-full left-0 right-0 mt-2 rounded-md border border-gray-200 bg-white shadow-lg overflow-hidden">
                        <div className="slim-scrollbar max-h-72 overflow-y-auto space-y-1">
                          {filteredContacts.length === 0 ? (
                            <p className="px-3 py-2 text-sm text-gray-500">
                              No matching contacts
                            </p>
                          ) : (
                            filteredContacts.map((contact) => (
                              <button
                                key={contact.contact_id}
                                onClick={() => {
                                  toggleContact(contact.contact_id);
                                  setSearchQuery("");
                                }}
                                className={`w-full flex items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                  selectedContactIds.includes(
                                    contact.contact_id,
                                  )
                                    ? "bg-indigo-50 text-indigo-700 font-medium"
                                    : "text-gray-700 hover:bg-gray-50"
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className="font-medium truncate">
                                    {contact.contact_name}
                                  </p>
                                  <p className="text-xs text-gray-500 truncate">
                                    {contact.contact_email}
                                  </p>
                                </div>
                                {selectedContactIds.includes(
                                  contact.contact_id,
                                ) && <CheckCircle2 size={14} />}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {showBccField && (
                  <div className="relative" ref={bccDropdownRef}>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Bcc
                    </label>
                    <div
                      className={`min-h-11 relative rounded-md border bg-white transition-all px-2.5 py-2 flex flex-wrap items-center gap-2 pr-10 ${
                        bccContactIds.length === 0
                          ? "border-gray-200 focus-within:border-indigo-300"
                          : "border-indigo-200 bg-indigo-50"
                      }`}
                      onClick={() => {
                        setIsBccDropdownOpen(true);
                        document.getElementById("bcc-search-input")?.focus();
                      }}
                    >
                      {bccContactIds.map((id) => {
                        const contact = contacts.find(
                          (c) => c.contact_id === id,
                        );
                        if (!contact) return null;
                        return (
                          <div
                            key={contact.contact_id}
                            className="inline-flex items-center gap-1.5 rounded-md border border-indigo-100 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700"
                          >
                            <span className="truncate max-w-35">
                              {contact.contact_email}
                            </span>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleBccContact(contact.contact_id);
                              }}
                              className="text-indigo-400 hover:text-indigo-700"
                            >
                              x
                            </button>
                          </div>
                        );
                      })}

                      <input
                        id="bcc-search-input"
                        type="text"
                        placeholder={
                          bccContactIds.length === 0
                            ? "Type name or email address..."
                            : ""
                        }
                        className="flex-1 min-w-30 bg-transparent border-none p-0 h-7 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
                        value={bccSearchQuery}
                        onFocus={() => setIsBccDropdownOpen(true)}
                        onChange={(event) => {
                          setBccSearchQuery(event.target.value);
                          setIsBccDropdownOpen(true);
                        }}
                      />

                      {bccContactIds.length > 0 && (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            setBccContactIds([]);
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                          title="Clear all Bcc recipients"
                        >
                          ×
                        </button>
                      )}

                      {isBccDropdownOpen && (
                        <div className="absolute z-40 top-full left-0 right-0 mt-2 rounded-md border border-gray-200 bg-white shadow-lg overflow-hidden">
                          <div className="slim-scrollbar max-h-72 overflow-y-auto space-y-1">
                            {filteredBccContacts.length === 0 ? (
                              <p className="px-3 py-2 text-sm text-gray-500">
                                No matching contacts
                              </p>
                            ) : (
                              filteredBccContacts.map((contact) => (
                                <button
                                  key={contact.contact_id}
                                  onClick={() => {
                                    toggleBccContact(contact.contact_id);
                                    setBccSearchQuery("");
                                  }}
                                  className={`w-full flex items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                    bccContactIds.includes(contact.contact_id)
                                      ? "bg-indigo-50 text-indigo-700 font-medium"
                                      : "text-gray-700 hover:bg-gray-50"
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <p className="font-medium truncate">
                                      {contact.contact_name}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate">
                                      {contact.contact_email}
                                    </p>
                                  </div>
                                  {bccContactIds.includes(
                                    contact.contact_id,
                                  ) && <CheckCircle2 size={14} />}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Send Button */}
                <div className="pt-1">
                  <button
                    onClick={handleSend}
                    disabled={loading || selectedContactIds.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Sending..." : "Send Campaign"}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Preview */}
            <div className="bg-white rounded-md border border-gray-200 p-3 lg:p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 text-sm text-gray-700 font-medium">
                  <Eye className="h-4 w-4 text-gray-500" />
                  Preview
                </div>
              </div>

              <div className="flex gap-2 mb-3 items-start border-t border-gray-200 pt-2">
                <span className="text-xs font-medium text-gray-700 min-w-5">
                  To:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                  {selectedContactIds.length > 0 ? (
                    (() => {
                      const selectedContacts = contacts.filter((c) =>
                        selectedContactIds.includes(c.contact_id),
                      );
                      const displayedContacts = showAllInPreview
                        ? selectedContacts
                        : selectedContacts.slice(0, 5);
                      const remainingCount = selectedContacts.length - 5;

                      return (
                        <>
                          {displayedContacts.map((contact) => (
                            <span
                              key={contact.contact_id}
                              className="text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md"
                            >
                              {contact.contact_email}
                            </span>
                          ))}
                          {remainingCount > 0 && !showAllInPreview && (
                            <button
                              onClick={() => setShowAllInPreview(true)}
                              className="text-[11px] font-medium text-indigo-600 px-1 py-1"
                            >
                              + {remainingCount} more
                            </button>
                          )}
                          {showAllInPreview && selectedContacts.length > 5 && (
                            <button
                              onClick={() => setShowAllInPreview(false)}
                              className="text-[11px] font-medium text-indigo-600 px-1 py-1"
                            >
                              Show less
                            </button>
                          )}
                        </>
                      );
                    })()
                  ) : (
                    <span className="text-sm text-gray-400 italic">
                      No recipients selected
                    </span>
                  )}
                </div>
              </div>

              {showBccField && (
                <div className="flex gap-2 mb-3 items-start pt-1">
                  <span className="text-xs font-medium text-gray-700 min-w-5">
                    Bcc:
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                    {bccContactIds.length > 0 ? (
                      (() => {
                        const bccContacts = contacts.filter((contact) =>
                          bccContactIds.includes(contact.contact_id),
                        );
                        return bccContacts.map((contact) => (
                          <span
                            key={contact.contact_id}
                            className="text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md"
                          >
                            {contact.contact_email}
                          </span>
                        ));
                      })()
                    ) : (
                      <span className="text-sm text-gray-400 italic">
                        No Bcc recipients selected
                      </span>
                    )}
                  </div>
                </div>
              )}

              {(campaign?.campaign_body || campaign?.template_body) &&
              campaign?.campaign_subject ? (
                <div>
                  <div className="mb-2 border-t border-gray-200 pt-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {campaign.campaign_subject}
                    </p>
                  </div>
                  <div className="overflow-hidden rounded-md border border-gray-200">
                    <div
                      ref={previewViewportRef}
                      className="bg-white relative overflow-hidden"
                      style={{ height: `${iframeHeight}px` }}
                    >
                      <iframe
                        ref={previewIframeRef}
                        title="Campaign Preview"
                        onLoad={handleIframeLoad}
                        srcDoc={getPreviewHtml()}
                        className="w-full border-none transition-all duration-300"
                        style={{
                          width: `${iframeContentWidth}px`,
                          height: `${iframeContentHeight}px`,
                          transform: `scale(${iframeScale})`,
                          transformOrigin: "top left",
                          fontSize: "13px",
                          overflow: "hidden",
                        }}
                        scrolling="no"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-160 flex flex-col items-center justify-center rounded-md border border-dashed border-gray-200 bg-gray-50">
                  <FileText className="h-8 w-8 text-gray-300 mb-3" />
                  <h4 className="text-sm font-semibold text-gray-500">
                    No Content
                  </h4>
                  <p className="text-xs text-gray-400 mt-1">
                    Campaign has no content to preview
                  </p>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default SendCampaignDetails;
