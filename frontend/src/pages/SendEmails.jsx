import React, { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  Users,
  FileText,
  UserRound,
  X,
} from "lucide-react";

const MIN_PREVIEW_HEIGHT = 240;
const MAX_PREVIEW_HEIGHT = 1400;

const hasUnsubscribeMarkup = (html = "") =>
  /(\{\{\s*unsubscribe_url\s*\}\}|\/unsubscribe\b|>\s*unsubscribe\s*<)/i.test(
    String(html || ""),
  );

const SendEmails = () => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [templates, setTemplates] = useState([]);

  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRecipientsDropdownOpen, setIsRecipientsDropdownOpen] =
    useState(false);
  const [showBccField, setShowBccField] = useState(false);
  const [bccContactIds, setBccContactIds] = useState([]);
  const [bccSearch, setBccSearch] = useState("");
  const [isBccDropdownOpen, setIsBccDropdownOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const [showAllInPreview, setShowAllInPreview] = useState(false);
  const templateDropdownRef = useRef(null);
  const recipientsDropdownRef = useRef(null);
  const bccDropdownRef = useRef(null);
  const bccInputRef = useRef(null);
  const previewViewportRef = useRef(null);
  const previewIframeRef = useRef(null);
  const [showRequiredHints, setShowRequiredHints] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(500);
  const [iframeScale, setIframeScale] = useState(1);
  const [iframeContentHeight, setIframeContentHeight] = useState(500);
  const [iframeContentWidth, setIframeContentWidth] = useState(700);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        recipientsDropdownRef.current &&
        !recipientsDropdownRef.current.contains(event.target)
      ) {
        setIsRecipientsDropdownOpen(false);
      }

      if (
        templateDropdownRef.current &&
        !templateDropdownRef.current.contains(event.target)
      ) {
        setIsTemplateDropdownOpen(false);
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

  const fetchInitialData = async () => {
    try {
      const [contactsRes, templatesRes] = await Promise.all([
        api.get("/contacts"),
        api.get("/templates"),
      ]);
      setContacts(Array.isArray(contactsRes.data) ? contactsRes.data : []);
      setTemplates(Array.isArray(templatesRes.data) ? templatesRes.data : []);
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  const activeContacts = useMemo(
    () => contacts.filter((c) => c.contact_status === "active"),
    [contacts],
  );

  const filteredContacts = useMemo(() => {
    if (!searchQuery) return activeContacts;
    const query = searchQuery.toLowerCase();
    return activeContacts.filter(
      (c) =>
        (c.contact_name || "").toLowerCase().includes(query) ||
        (c.contact_email || "").toLowerCase().includes(query),
    );
  }, [activeContacts, searchQuery]);

  const filteredBccContacts = useMemo(() => {
    if (!bccSearch) return activeContacts;
    const query = bccSearch.toLowerCase();
    return activeContacts.filter(
      (c) =>
        (c.contact_name || "").toLowerCase().includes(query) ||
        (c.contact_email || "").toLowerCase().includes(query),
    );
  }, [activeContacts, bccSearch]);

  const selectedBccRecipients = useMemo(
    () => activeContacts.filter((c) => bccContactIds.includes(c.contact_id)),
    [activeContacts, bccContactIds],
  );

  const toggleContact = (contactId) => {
    setSelectedContactIds((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId],
    );
  };

  const toggleBccField = () => {
    if (showBccField) {
      setShowBccField(false);
      setBccContactIds([]);
      setBccSearch("");
      setIsBccDropdownOpen(false);
      return;
    }

    setShowBccField(true);
    setIsBccDropdownOpen(true);
  };

  const toggleBccContact = (contactId) => {
    setBccContactIds((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId],
    );
  };

  const removeBccContact = (contactId) => {
    setBccContactIds((prev) => prev.filter((id) => id !== contactId));
  };

  const clearBccSelection = () => {
    setBccContactIds([]);
    setBccSearch("");
    setIsBccDropdownOpen(false);
  };

  const handleSendEmail = async () => {
    setShowRequiredHints(true);

    if (!selectedTemplateId) {
      return;
    }

    if (selectedContactIds.length === 0) {
      return;
    }

    setLoading(true);

    try {
      const template = templates.find(
        (t) => t.template_id === Number(selectedTemplateId),
      );
      if (!template) throw new Error("Template not found");

      const contactSegment = `ids:${selectedContactIds.join(",")}`;
      const bccSegment =
        showBccField && bccContactIds.length > 0
          ? `ids:${bccContactIds.join(",")}`
          : null;

      const campaignPayload = {
        campaign_name: `Quick Send - ${template.template_name || "Untitled Template"}`,
        campaign_subject: template.template_subject || "No Subject",
        campaign_body: template.template_body || "",
        template_id: template.template_id,
        contact_segment: contactSegment,
        bcc_segment: bccSegment,
        campaign_status: "draft",
      };

      const createRes = await api.post("/campaigns", campaignPayload);
      const campaignId = createRes.data.id;

      await api.post(`/campaigns/${campaignId}/send-draft`, {
        selectedContactIds,
      });

      setSelectedTemplateId("");
      setSelectedContactIds([]);
      setShowBccField(false);
      setBccContactIds([]);
      setBccSearch("");
      setSearchQuery("");
      setShowRequiredHints(false);
      navigate("/email-logs");
    } catch (error) {
      console.error("Failed to send emails:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectedTemplate = useMemo(() => {
    return (
      templates.find((t) => t.template_id === Number(selectedTemplateId)) ||
      null
    );
  }, [selectedTemplateId, templates]);

  const selectedTemplateName = selectedTemplate
    ? selectedTemplate.template_name
    : "Select Template";
  const isRecipientsMissing =
    showRequiredHints && selectedContactIds.length === 0;
  const isTemplateMissing = showRequiredHints && !selectedTemplateId;

  const targetLabel = useMemo(() => {
    if (selectedContactIds.length > 0) {
      const selectedEmails = activeContacts
        .filter((c) => selectedContactIds.includes(c.contact_id))
        .map((c) => c.contact_email);
      return selectedEmails.join(", ");
    }
    return "No recipients selected";
  }, [selectedContactIds, activeContacts]);

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
    } catch (error) {
      console.error("Failed to update send-email preview layout:", error);
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
  }, [selectedTemplate?.template_body]);

  useEffect(() => {
    const handleResize = () => updatePreviewLayout();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const viewport = previewViewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(() => updatePreviewLayout());
    });

    observer.observe(viewport);

    return () => observer.disconnect();
  }, []);

  const applyPreviewMergeTags = (content = "") =>
    String(content || "")
      .replace(/\{\{\s*name\s*\}\}/gi, "John Doe")
      .replace(/\{\{\s*email\s*\}\}/gi, "john.doe@example.com")
      .replace(/\{\{\s*unsubscribe_url\s*\}\}/gi, "/unsubscribe");

  const getTemplatePreviewHtml = () => {
    const previewContent = applyPreviewMergeTags(
      selectedTemplate?.template_body || "",
    );

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
              body {
                margin: 0;
                padding: 0;
                font-family: sans-serif;
                font-size: 13px;
                color: #222;
              }
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
            body {
              margin: 0;
              padding: 0;
              font-family: sans-serif;
              font-size: 13px;
              color: #222;
            }
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

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 font-sans">
      <Sidebar />

      <div className="flex-1 ml-64 overflow-y-auto">
        <main className="p-6 lg:p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              Send Emails
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Configure your email options and preview your message before
              dispatching.
            </p>
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-5 items-start">
            <div className="bg-white rounded-md border border-gray-200 p-4 lg:p-5 space-y-5">
              <h2 className="text-sm font-semibold text-gray-800">
                Email Options
              </h2>

              <div className="space-y-5">
                <div className="relative" ref={recipientsDropdownRef}>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <label className="block text-xs font-medium text-gray-700">
                      To
                    </label>
                    <button
                      type="button"
                      onClick={toggleBccField}
                      className="text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-700"
                    >
                      {showBccField ? "Remove Bcc" : "Add Bcc"}
                    </button>
                  </div>
                  <div
                    className={`min-h-11 relative rounded-md border bg-white transition-all px-2.5 py-2 flex flex-wrap items-center gap-2 pr-10 ${
                      isRecipientsMissing
                        ? "border-red-400 focus-within:border-red-500"
                        : selectedContactIds.length === 0
                          ? "border-gray-200 focus-within:border-indigo-300"
                          : "border-indigo-200 bg-indigo-50"
                    }`}
                    onClick={() => {
                      setIsRecipientsDropdownOpen(true);
                      document.getElementById("contact-search-input")?.focus();
                    }}
                  >
                    <div className="flex items-center text-gray-400">
                      <Users size={15} />
                    </div>

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
                        x
                      </button>
                    )}
                  </div>

                  {isRecipientsMissing && (
                    <p className="mt-1 text-sm text-red-500">Required</p>
                  )}

                  {isRecipientsDropdownOpen && (
                    <div className="absolute z-30 left-0 right-0 mt-2 bg-white border border-gray-200 shadow-lg rounded-md overflow-hidden">
                      <div className="slim-scrollbar max-h-64 overflow-y-auto">
                        {filteredContacts.length > 0 ? (
                          filteredContacts.map((contact) => (
                            <button
                              key={contact.contact_id}
                              onClick={() => {
                                if (
                                  !selectedContactIds.includes(
                                    contact.contact_id,
                                  )
                                ) {
                                  toggleContact(contact.contact_id);
                                }
                                setSearchQuery("");
                                setIsRecipientsDropdownOpen(true);
                              }}
                              className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md text-left text-sm ${
                                selectedContactIds.includes(contact.contact_id)
                                  ? "bg-indigo-50 text-indigo-700"
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
                        ) : (
                          <div className="py-8 text-center text-sm text-gray-500">
                            No matching contacts
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {showBccField && (
                  <div ref={bccDropdownRef} className="relative">
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Bcc
                    </label>
                    <div
                      className={`min-h-11 rounded-md border bg-white px-2.5 py-2 transition-all ${
                        bccContactIds.length === 0
                          ? "border-gray-200 focus-within:border-indigo-300"
                          : "border-indigo-200 bg-indigo-50"
                      }`}
                      onClick={() => {
                        setIsBccDropdownOpen(true);
                        bccInputRef.current?.focus();
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <div className="pt-1 text-gray-400">
                          <UserRound className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {selectedBccRecipients.map((contact) => (
                              <span
                                key={contact.contact_id}
                                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700"
                              >
                                <span className="truncate max-w-35">
                                  {contact.contact_email}
                                </span>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    removeBccContact(contact.contact_id);
                                  }}
                                  className="text-indigo-500 transition-colors hover:text-indigo-700"
                                  aria-label={`Remove ${contact.contact_email}`}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </span>
                            ))}
                            <input
                              ref={bccInputRef}
                              type="text"
                              value={bccSearch}
                              onFocus={() => setIsBccDropdownOpen(true)}
                              onChange={(event) => {
                                setBccSearch(event.target.value);
                                setIsBccDropdownOpen(true);
                              }}
                              placeholder="Enter Bcc Emails"
                              className="min-w-50 flex-1 border-none bg-transparent h-7 text-sm text-gray-700 placeholder:text-gray-500 focus:outline-none"
                            />
                          </div>
                        </div>
                        {(bccContactIds.length > 0 || bccSearch) && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              clearBccSelection();
                            }}
                            className="pt-1 text-gray-400 transition-colors hover:text-gray-600"
                            aria-label="Clear Bcc"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {isBccDropdownOpen && (
                      <div className="absolute z-30 left-0 right-0 mt-2 bg-white border border-gray-200 shadow-lg rounded-md overflow-hidden">
                        <div className="slim-scrollbar max-h-64 overflow-y-auto p-1">
                          {filteredBccContacts.length > 0 ? (
                            filteredBccContacts.map((contact) => {
                              const isSelected = bccContactIds.includes(
                                contact.contact_id,
                              );

                              return (
                                <button
                                  key={contact.contact_id}
                                  type="button"
                                  onClick={() => {
                                    toggleBccContact(contact.contact_id);
                                    setBccSearch("");
                                    setIsBccDropdownOpen(true);
                                  }}
                                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md text-left ${
                                    isSelected
                                      ? "bg-indigo-50 text-indigo-700"
                                      : "text-gray-700 hover:bg-gray-50"
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <p
                                      className={`truncate text-sm font-semibold ${
                                        isSelected
                                          ? "text-indigo-700"
                                          : "text-gray-800"
                                      }`}
                                    >
                                      {contact.contact_name || "Unnamed"}
                                    </p>
                                    <p className="truncate text-xs text-gray-500">
                                      {contact.contact_email}
                                    </p>
                                  </div>
                                  {isSelected && <CheckCircle2 size={14} />}
                                </button>
                              );
                            })
                          ) : (
                            <div className="py-8 text-center text-sm text-gray-500">
                              No matching contacts
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Select Template
                  </label>
                  <div ref={templateDropdownRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setIsTemplateDropdownOpen((prev) => !prev)}
                      className={`w-full rounded-md border bg-white px-3 py-2.5 text-left text-sm text-gray-700 transition-all focus:outline-none flex items-center justify-between ${
                        isTemplateMissing
                          ? "border-red-400 focus:border-red-500"
                          : "border-gray-200 focus:border-indigo-300"
                      }`}
                    >
                      <span className="truncate">{selectedTemplateName}</span>
                      {isTemplateDropdownOpen ? (
                        <ChevronUp className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      )}
                    </button>

                    {isTemplateMissing && (
                      <p className="mt-1 text-sm text-red-500">Required</p>
                    )}

                    {isTemplateDropdownOpen && (
                      <div className="absolute z-40 mt-2 w-full rounded-md border border-gray-200 bg-white shadow-lg overflow-hidden">
                        <div className="slim-scrollbar max-h-72 overflow-y-auto space-y-1">
                          {templates.length === 0 ? (
                            <p className="px-3 py-2 text-sm text-gray-500">
                              No templates available
                            </p>
                          ) : (
                            templates.map((template) => {
                              const isSelected =
                                String(template.template_id) ===
                                String(selectedTemplateId);

                              return (
                                <button
                                  key={template.template_id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedTemplateId(
                                      String(template.template_id),
                                    );
                                    setIsTemplateDropdownOpen(false);
                                  }}
                                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                    isSelected
                                      ? "bg-indigo-50 text-indigo-700 font-medium"
                                      : "text-gray-700 hover:bg-gray-50"
                                  }`}
                                >
                                  {template.template_name}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleSendEmail}
                    disabled={loading}
                  >
                    {loading ? "Sending..." : "Send Email"}
                  </button>
                </div>
              </div>
            </div>

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
                    {selectedBccRecipients.length > 0 ? (
                      selectedBccRecipients.map((contact) => (
                        <span
                          key={contact.contact_id}
                          className="text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md"
                        >
                          {contact.contact_email}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-400 italic">
                        No Bcc recipients selected
                      </span>
                    )}
                  </div>
                </div>
              )}

              {selectedTemplate ? (
                <div>
                  <div className="mb-2 border-t border-gray-200 pt-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {selectedTemplate.template_subject}
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
                        title="Template Preview"
                        onLoad={handleIframeLoad}
                        srcDoc={getTemplatePreviewHtml()}
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
                    No Template Selected
                  </h4>
                  <p className="text-xs text-gray-400 mt-1">
                    Pick a template to preview its layout
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

export default SendEmails;
