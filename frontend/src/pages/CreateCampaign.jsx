import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  UserRound,
  X,
} from "lucide-react";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";
const MIN_PREVIEW_HEIGHT = 240;
const MAX_PREVIEW_HEIGHT = 1400;

const initialFormData = {
  campaign_name: "",
  template_id: "",
  campaign_subject: "",
  campaign_body: "",
  contact_segment: "all",
  bcc_segment: "",
  schedule_option: "draft",
  scheduled_date: "",
};

const hasUnsubscribeMarkup = (html = "") =>
  /(\{\{\s*unsubscribe_url\s*\}\}|\/unsubscribe\b|>\s*unsubscribe\s*<)/i.test(
    String(html || ""),
  );

const CreateCampaign = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { campaignId } = useParams();
  const [editingCampaign, setEditingCampaign] = useState(
    location.state?.campaign || null,
  );

  const [formData, setFormData] = useState(initialFormData);
  const [templates, setTemplates] = useState([]);
  const [groups, setGroups] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [previewRecipients, setPreviewRecipients] = useState([]);
  const [showAllInPreview, setShowAllInPreview] = useState(false);
  const [error, setError] = useState("");
  const [showRequired, setShowRequired] = useState(false);
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const [isRecipientsDropdownOpen, setIsRecipientsDropdownOpen] =
    useState(false);
  const [showBccField, setShowBccField] = useState(false);
  const [bccContactIds, setBccContactIds] = useState([]);
  const [bccSearch, setBccSearch] = useState("");
  const [isBccDropdownOpen, setIsBccDropdownOpen] = useState(false);
  const [isDeliveryDropdownOpen, setIsDeliveryDropdownOpen] = useState(false);
  const templateDropdownRef = useRef(null);
  const recipientsDropdownRef = useRef(null);
  const bccDropdownRef = useRef(null);
  const deliveryDropdownRef = useRef(null);
  const bccInputRef = useRef(null);
  const previewViewportRef = useRef(null);
  const previewIframeRef = useRef(null);
  const [iframeHeight, setIframeHeight] = useState(500);
  const [iframeScale, setIframeScale] = useState(1);
  const [iframeContentHeight, setIframeContentHeight] = useState(500);
  const [iframeContentWidth, setIframeContentWidth] = useState(700);

  const parseSegmentIds = (segment = "") => {
    const value = String(segment || "")
      .trim()
      .toLowerCase();
    if (!value.startsWith("ids:")) {
      return [];
    }

    return Array.from(
      new Set(
        value
          .replace("ids:", "")
          .split(",")
          .map((id) => Number.parseInt(id.trim(), 10))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    );
  };

  const bccSegmentValue = useMemo(() => {
    if (!showBccField || bccContactIds.length === 0) {
      return "";
    }

    return `ids:${bccContactIds.join(",")}`;
  }, [bccContactIds, showBccField]);

  const selectedBccRecipients = useMemo(() => {
    const selectedIdSet = new Set(bccContactIds);
    return contacts.filter((contact) => selectedIdSet.has(contact.contact_id));
  }, [bccContactIds, contacts]);

  const filteredBccContacts = useMemo(() => {
    const searchTerm = bccSearch.trim().toLowerCase();

    return contacts.filter((contact) => {
      const isActive = String(contact.contact_status || "") === "active";
      if (!isActive) {
        return false;
      }

      if (!searchTerm) {
        return true;
      }

      return (
        String(contact.contact_name || "")
          .toLowerCase()
          .includes(searchTerm) ||
        String(contact.contact_email || "")
          .toLowerCase()
          .includes(searchTerm)
      );
    });
  }, [bccSearch, contacts]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [templateResponse, groupResponse, contactsResponse] =
          await Promise.all([
            api.get("/templates"),
            api.get("/contact-groups"),
            api.get("/contacts"),
          ]);

        setTemplates(templateResponse.data);
        setGroups(groupResponse.data);
        setContacts(
          Array.isArray(contactsResponse.data) ? contactsResponse.data : [],
        );
      } catch (requestError) {
        setError(
          requestError.response?.data?.message || "Failed to load form data",
        );
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        templateDropdownRef.current &&
        !templateDropdownRef.current.contains(event.target)
      ) {
        setIsTemplateDropdownOpen(false);
      }

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

      if (
        deliveryDropdownRef.current &&
        !deliveryDropdownRef.current.contains(event.target)
      ) {
        setIsDeliveryDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    const stateCampaign = location.state?.campaign || null;

    if (stateCampaign && !campaignId) {
      setEditingCampaign(stateCampaign);
      return;
    }

    if (!campaignId) {
      setEditingCampaign(null);
      return;
    }

    let cancelled = false;

    const fetchCampaign = async () => {
      try {
        const response = await api.get(`/campaigns/${campaignId}`);
        if (!cancelled) {
          setEditingCampaign(response.data || null);
        }
      } catch (requestError) {
        if (!cancelled) {
          setEditingCampaign(null);
          setError(
            requestError.response?.data?.message || "Failed to load campaign",
          );
        }
      }
    };

    fetchCampaign();

    return () => {
      cancelled = true;
    };
  }, [campaignId, location.state]);

  useEffect(() => {
    if (!editingCampaign) {
      setFormData(initialFormData);
      setShowBccField(false);
      setBccContactIds([]);
      setBccSearch("");
      return;
    }

    const status = String(
      editingCampaign.campaign_status || "draft",
    ).toLowerCase();
    const normalizedBccIds = parseSegmentIds(editingCampaign.bcc_segment);

    setFormData({
      campaign_name: editingCampaign.campaign_name || "",
      template_id: editingCampaign.template_id || "",
      campaign_subject: editingCampaign.campaign_subject || "",
      campaign_body: editingCampaign.campaign_body || "",
      contact_segment: editingCampaign.contact_segment || "all",
      bcc_segment:
        normalizedBccIds.length > 0 ? `ids:${normalizedBccIds.join(",")}` : "",
      schedule_option:
        status === "scheduled"
          ? "scheduled"
          : status === "sent"
            ? "sent"
            : "draft",
      scheduled_date: editingCampaign.scheduled_date
        ? new Date(editingCampaign.scheduled_date).toISOString().slice(0, 16)
        : "",
    });

    setShowBccField(normalizedBccIds.length > 0);
    setBccContactIds(normalizedBccIds);
    setBccSearch("");
  }, [editingCampaign]);

  useEffect(() => {
    setFormData((prev) => {
      if (prev.bcc_segment === bccSegmentValue) {
        return prev;
      }

      return {
        ...prev,
        bcc_segment: bccSegmentValue,
      };
    });
  }, [bccSegmentValue]);

  useEffect(() => {
    let cancelled = false;

    const loadPreviewRecipients = async () => {
      const segment = String(formData.contact_segment || "all");

      try {
        if (segment === "all" || segment === "active" || !segment) {
          if (!cancelled) {
            setPreviewRecipients(
              contacts.filter((contact) => contact.contact_status === "active"),
            );
          }
          return;
        }

        if (segment === "unsubscribed") {
          if (!cancelled) {
            setPreviewRecipients(
              contacts.filter(
                (contact) => contact.contact_status === "unsubscribed",
              ),
            );
          }
          return;
        }

        if (segment.startsWith("ids:")) {
          const ids = segment
            .replace("ids:", "")
            .split(",")
            .map((id) => Number.parseInt(id.trim(), 10))
            .filter((id) => !Number.isNaN(id));

          if (!cancelled) {
            setPreviewRecipients(
              contacts.filter((contact) => ids.includes(contact.contact_id)),
            );
          }
          return;
        }

        if (segment.startsWith("group:")) {
          const groupId = Number.parseInt(segment.replace("group:", ""), 10);
          if (!groupId || Number.isNaN(groupId)) {
            if (!cancelled) {
              setPreviewRecipients([]);
            }
            return;
          }

          const response = await api.get(`/contact-groups/${groupId}/contacts`);
          if (!cancelled) {
            setPreviewRecipients(
              Array.isArray(response.data) ? response.data : [],
            );
          }
          return;
        }

        if (!cancelled) {
          setPreviewRecipients([]);
        }
      } catch {
        if (!cancelled) {
          setPreviewRecipients([]);
        }
      }
    };

    loadPreviewRecipients();
    setShowAllInPreview(false);

    return () => {
      cancelled = true;
    };
  }, [formData.contact_segment, contacts]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setError("");

    if (name === "template_id") {
      const selectedTemplate = templates.find(
        (template) => String(template.template_id) === String(value),
      );

      setFormData((prev) => ({
        ...prev,
        template_id: value,
        campaign_subject: selectedTemplate?.template_subject || "",
        campaign_body: selectedTemplate?.template_body || "",
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleTemplateSelect = (value) => {
    setError("");
    const selectedTemplateOption = templates.find(
      (template) => String(template.template_id) === String(value),
    );

    setFormData((prev) => ({
      ...prev,
      template_id: value,
      campaign_subject: selectedTemplateOption?.template_subject || "",
      campaign_body: selectedTemplateOption?.template_body || "",
    }));

    setIsTemplateDropdownOpen(false);
  };

  const handleRecipientsSelect = (value) => {
    setError("");
    setFormData((prev) => ({
      ...prev,
      contact_segment: value,
    }));
    setIsRecipientsDropdownOpen(false);
  };

  const handleDeliverySelect = (value) => {
    setError("");
    setFormData((prev) => ({
      ...prev,
      schedule_option: value,
    }));
    setIsDeliveryDropdownOpen(false);
  };

  const toggleBccField = () => {
    setError("");

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

  const toggleBccContactSelection = (contactId) => {
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setShowRequired(true);

    const missingFields = [];

    if (!formData.campaign_name.trim()) {
      missingFields.push("Campaign name");
    }

    if (!String(formData.template_id || "").trim()) {
      missingFields.push("Template");
    }

    if (!String(formData.contact_segment || "").trim()) {
      missingFields.push("Recipients");
    }

    if (missingFields.length > 0) {
      return;
    }

    if (formData.schedule_option === "scheduled") {
      if (!formData.scheduled_date) {
        return;
      }

      const scheduledAt = new Date(formData.scheduled_date);
      if (Number.isNaN(scheduledAt.getTime())) {
        setError("Please enter a valid schedule date and time");
        return;
      }

      if (scheduledAt.getTime() < Date.now()) {
        setError("Scheduled date must be in the future");
        return;
      }
    }

    const selectedTemplate = templates.find(
      (template) =>
        String(template.template_id) === String(formData.template_id),
    );

    const campaignSubject =
      formData.campaign_subject?.trim() ||
      selectedTemplate?.template_subject?.trim() ||
      "";
    const campaignBody =
      formData.campaign_body?.trim() ||
      selectedTemplate?.template_body?.trim() ||
      "";

    if (!campaignSubject || !campaignBody) {
      setError("Selected template is missing subject or body content");
      return;
    }

    const payload = {
      campaign_name: formData.campaign_name.trim(),
      template_id: formData.template_id || null,
      campaign_subject: campaignSubject,
      campaign_body: campaignBody,
      contact_segment: formData.contact_segment,
      bcc_segment: bccSegmentValue || null,
      campaign_status:
        formData.schedule_option === "scheduled" ? "scheduled" : "draft",
      scheduled_date:
        formData.schedule_option === "scheduled"
          ? formData.scheduled_date
          : null,
    };

    try {
      let campaignId = editingCampaign?.campaign_id;

      if (editingCampaign?.campaign_id) {
        await api.put(`/campaigns/${editingCampaign.campaign_id}`, payload);
      } else {
        const response = await api.post("/campaigns", payload);
        campaignId = response.data?.id;
      }

      if (formData.schedule_option === "sent") {
        if (!campaignId) {
          setError("Campaign saved but send failed: missing campaign id");
          return;
        }

        await api.post(`/campaigns/${campaignId}/send`);
      }

      navigate("/campaigns");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Failed to save campaign",
      );
    }
  };

  const shellWrapperClass =
    "relative rounded-md border border-gray-200 bg-white transition-all focus-within:border-indigo-300";
  const shellInputClass =
    "w-full rounded-md border-none bg-transparent px-3 py-2 text-sm text-gray-700 placeholder:text-gray-500 focus:outline-none";
  const selectedTemplate = templates.find(
    (template) => String(template.template_id) === String(formData.template_id),
  );
  const selectedTemplateName = selectedTemplate
    ? selectedTemplate.template_name
    : "Select Template";
  const selectedRecipientsLabel =
    formData.contact_segment === "all"
      ? "To: All Contacts"
      : (() => {
          const selectedGroup = groups.find(
            (group) => `group:${group.group_id}` === formData.contact_segment,
          );
          return selectedGroup
            ? `To: Group: ${selectedGroup.group_name}`
            : "To: Select Recipients";
        })();
  const selectedDeliveryLabel =
    formData.schedule_option === "sent"
      ? "Send Now"
      : formData.schedule_option === "scheduled"
        ? "Schedule for Later"
        : "Save as Draft";
  const previewSubject =
    selectedTemplate?.template_subject || formData.campaign_subject;
  const previewBody = selectedTemplate?.template_body || formData.campaign_body;
  const campaignNameRequired =
    showRequired && !String(formData.campaign_name || "").trim();
  const templateRequired =
    showRequired && !String(formData.template_id || "").trim();
  const recipientsRequired =
    showRequired && !String(formData.contact_segment || "").trim();
  const scheduledDateRequired =
    showRequired &&
    formData.schedule_option === "scheduled" &&
    !String(formData.scheduled_date || "").trim();
  const minScheduleDateTime = new Date(
    Date.now() - new Date().getTimezoneOffset() * 60000,
  )
    .toISOString()
    .slice(0, 16);

  const isReadOnly =
    editingCampaign &&
    String(editingCampaign.campaign_status || "draft").toLowerCase() === "sent";

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
    } catch (layoutError) {
      console.error("Failed to update campaign preview layout:", layoutError);
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
  }, [previewBody]);

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

  const getPreviewHtml = () => {
    const previewContent = applyPreviewMergeTags(previewBody);

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
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 ml-64 overflow-y-auto">
        <main className="p-6 lg:p-8">
          <header className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              {editingCampaign
                ? isReadOnly
                  ? "View Campaign"
                  : "Edit Campaign"
                : "Create Campaign"}
            </h1>
            <p className="text-sm text-gray-500">
              {isReadOnly
                ? "This campaign has been sent and cannot be edited."
                : "Configure campaign basics before sending."}
            </p>
          </header>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-5 items-start">
            <div className="bg-white rounded-md border border-gray-200 p-5 space-y-5">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 gap-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Campaign Name
                    </label>
                    <div
                      className={`${shellWrapperClass} ${campaignNameRequired ? "border-red-400 focus-within:border-red-400" : ""} ${isReadOnly ? "bg-gray-50" : ""}`}
                    >
                      <input
                        type="text"
                        name="campaign_name"
                        value={formData.campaign_name}
                        onChange={handleInputChange}
                        disabled={isReadOnly}
                        className={`${shellInputClass} ${isReadOnly ? "cursor-not-allowed text-gray-500" : ""}`}
                        placeholder="Enter campaign name"
                      />
                    </div>
                    {campaignNameRequired && (
                      <p className="mt-1 text-sm text-red-500">Required</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Select Template
                    </label>
                    <div ref={templateDropdownRef} className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setIsTemplateDropdownOpen((prev) => !prev)
                        }
                        disabled={isReadOnly}
                        className={`w-full rounded-md border bg-white px-3 py-2 text-left text-sm text-gray-700 transition-all focus:outline-none flex items-center justify-between ${
                          templateRequired
                            ? "border-red-400 focus:border-red-400"
                            : "border-gray-200 focus:border-indigo-300"
                        } ${isReadOnly ? "bg-gray-50 cursor-not-allowed text-gray-500" : ""}`}
                      >
                        <span className="truncate">{selectedTemplateName}</span>
                        {isTemplateDropdownOpen ? (
                          <ChevronUp className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        )}
                      </button>

                      {isTemplateDropdownOpen && (
                        <div className="absolute z-40 mt-2 w-full rounded-md border border-gray-200 bg-white shadow-lg overflow-hidden">
                          <div className="slim-scrollbar max-h-72 overflow-y-auto space-y-1">
                            <button
                              type="button"
                              onClick={() => handleTemplateSelect("")}
                              className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                !formData.template_id
                                  ? "bg-indigo-50 text-indigo-700 font-medium"
                                  : "text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              Select Template
                            </button>
                            {templates.map((template) => {
                              const isSelected =
                                String(template.template_id) ===
                                String(formData.template_id);
                              return (
                                <button
                                  key={template.template_id}
                                  type="button"
                                  onClick={() =>
                                    handleTemplateSelect(
                                      String(template.template_id),
                                    )
                                  }
                                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                    isSelected
                                      ? "bg-indigo-50 text-indigo-700 font-medium"
                                      : "text-gray-700 hover:bg-gray-50"
                                  }`}
                                >
                                  {template.template_name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    {templateRequired && (
                      <p className="mt-1 text-sm text-red-500">Required</p>
                    )}
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <label className="block text-xs font-medium text-gray-700">
                        Select Recipients
                      </label>
                      <button
                        type="button"
                        onClick={toggleBccField}
                        disabled={isReadOnly}
                        className={`text-xs font-medium transition-colors ${
                          isReadOnly
                            ? "cursor-not-allowed text-gray-400"
                            : "text-indigo-600 hover:text-indigo-700"
                        }`}
                      >
                        {showBccField ? "Remove Bcc" : "Add Bcc"}
                      </button>
                    </div>
                    <div ref={recipientsDropdownRef} className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setIsRecipientsDropdownOpen((prev) => !prev)
                        }
                        disabled={isReadOnly}
                        className={`w-full rounded-md border bg-white px-3 py-2 text-left text-sm text-gray-700 transition-all focus:outline-none flex items-center justify-between ${
                          recipientsRequired
                            ? "border-red-400 focus:border-red-400"
                            : "border-gray-200 focus:border-indigo-300"
                        } ${isReadOnly ? "bg-gray-50 cursor-not-allowed text-gray-500" : ""}`}
                      >
                        <span className="truncate">
                          {selectedRecipientsLabel}
                        </span>
                        {isRecipientsDropdownOpen ? (
                          <ChevronUp className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        )}
                      </button>

                      {isRecipientsDropdownOpen && (
                        <div className="absolute z-40 mt-2 w-full rounded-md border border-gray-200 bg-white shadow-lg overflow-hidden">
                          <div className="slim-scrollbar max-h-72 overflow-y-auto space-y-1">
                            <button
                              type="button"
                              onClick={() => handleRecipientsSelect("all")}
                              className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                formData.contact_segment === "all"
                                  ? "bg-indigo-50 text-indigo-700 font-medium"
                                  : "text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              To: All Contacts
                            </button>
                            {groups.map((group) => {
                              const value = `group:${group.group_id}`;
                              const isSelected =
                                formData.contact_segment === value;
                              return (
                                <button
                                  key={group.group_id}
                                  type="button"
                                  onClick={() => handleRecipientsSelect(value)}
                                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                    isSelected
                                      ? "bg-indigo-50 text-indigo-700 font-medium"
                                      : "text-gray-700 hover:bg-gray-50"
                                  }`}
                                >
                                  To: Group: {group.group_name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    {recipientsRequired && (
                      <p className="mt-1 text-sm text-red-500">Required</p>
                    )}
                  </div>

                  {showBccField && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Bcc
                      </label>
                      <div ref={bccDropdownRef} className="relative">
                        <div
                          className={`rounded-md border bg-white px-2.5 py-1.5 transition-all ${
                            isReadOnly
                              ? "border-gray-200 bg-gray-50"
                              : "border-gray-200 focus-within:border-indigo-300"
                          }`}
                          onClick={() => {
                            if (isReadOnly) {
                              return;
                            }

                            setIsBccDropdownOpen(true);
                            bccInputRef.current?.focus();
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <div className="pt-1 text-gray-400">
                              <UserRound className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {selectedBccRecipients.map((contact) => (
                                  <span
                                    key={contact.contact_id}
                                    className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
                                  >
                                    <span className="truncate max-w-52.5">
                                      {contact.contact_email}
                                    </span>
                                    {!isReadOnly && (
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
                                    )}
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
                                  disabled={isReadOnly}
                                  placeholder="Enter Bcc Emails"
                                  className={`min-w-50 flex-1 border-none bg-transparent py-0.5 text-sm text-gray-700 placeholder:text-gray-500 focus:outline-none ${
                                    isReadOnly
                                      ? "cursor-not-allowed text-gray-500"
                                      : ""
                                  }`}
                                />
                              </div>
                            </div>
                            {(bccContactIds.length > 0 || bccSearch) &&
                              !isReadOnly && (
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

                        {isBccDropdownOpen && !isReadOnly && (
                          <div className="absolute z-40 mt-2 w-full rounded-md border border-gray-200 bg-white shadow-lg overflow-hidden">
                            <div className="slim-scrollbar max-h-80 overflow-y-auto p-1.5">
                              {filteredBccContacts.length > 0 ? (
                                filteredBccContacts.map((contact) => {
                                  const isSelected = bccContactIds.includes(
                                    contact.contact_id,
                                  );

                                  return (
                                    <button
                                      key={contact.contact_id}
                                      type="button"
                                      onClick={() =>
                                        toggleBccContactSelection(
                                          contact.contact_id,
                                        )
                                      }
                                      className={`w-full rounded-md px-3 py-2.5 text-left transition-colors flex items-center justify-between gap-3 ${
                                        isSelected
                                          ? "bg-indigo-50/80 text-indigo-700"
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
                                      <span
                                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                          isSelected
                                            ? "border-indigo-500 text-indigo-600"
                                            : "border-gray-300 text-transparent"
                                        }`}
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                      </span>
                                    </button>
                                  );
                                })
                              ) : (
                                <p className="px-3 py-2 text-sm text-gray-500">
                                  No matching contacts found.
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Delivery Option
                    </label>
                    <div ref={deliveryDropdownRef} className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setIsDeliveryDropdownOpen((prev) => !prev)
                        }
                        disabled={isReadOnly}
                        className={`w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-700 transition-all focus:outline-none focus:border-indigo-300 flex items-center justify-between ${isReadOnly ? "bg-gray-50 cursor-not-allowed text-gray-500" : ""}`}
                      >
                        <span className="truncate">
                          {selectedDeliveryLabel}
                        </span>
                        {isDeliveryDropdownOpen ? (
                          <ChevronUp className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        )}
                      </button>

                      {isDeliveryDropdownOpen && (
                        <div className="absolute z-40 mt-2 w-full rounded-md border border-gray-200 bg-white p-2 shadow-lg">
                          <div className="space-y-1">
                            {[
                              { value: "sent", label: "Send Now" },
                              {
                                value: "scheduled",
                                label: "Schedule for Later",
                              },
                              { value: "draft", label: "Save as Draft" },
                            ].map((option) => {
                              const isSelected =
                                formData.schedule_option === option.value;
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() =>
                                    handleDeliverySelect(option.value)
                                  }
                                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                    isSelected
                                      ? "bg-indigo-50 text-indigo-700 font-medium"
                                      : "text-gray-700 hover:bg-gray-50"
                                  }`}
                                >
                                  {option.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {formData.schedule_option === "scheduled" && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Scheduled Date
                      </label>
                      <div
                        className={`${shellWrapperClass} ${scheduledDateRequired ? "border-red-400 focus-within:border-red-400" : ""} ${isReadOnly ? "bg-gray-50" : ""}`}
                      >
                        <input
                          type="datetime-local"
                          name="scheduled_date"
                          value={formData.scheduled_date}
                          onChange={handleInputChange}
                          disabled={isReadOnly}
                          min={minScheduleDateTime}
                          className={`${shellInputClass} ${isReadOnly ? "cursor-not-allowed text-gray-500" : ""}`}
                        />
                      </div>
                      {scheduledDateRequired && (
                        <p className="mt-1 text-sm text-red-500">Required</p>
                      )}
                    </div>
                  )}

                  {error && <p className="text-sm text-red-500">{error}</p>}
                </div>

                <div className="flex justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => navigate("/campaigns")}
                    className="rounded-md border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {isReadOnly ? "Close" : "Cancel"}
                  </button>
                  {!isReadOnly && (
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
                    >
                      {editingCampaign ? "Update" : "Save"}
                      <ArrowRight size={18} />
                    </button>
                  )}
                </div>
              </form>
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
                  {previewRecipients.length > 0 ? (
                    (() => {
                      const displayedContacts = showAllInPreview
                        ? previewRecipients
                        : previewRecipients.slice(0, 5);
                      const remainingCount = previewRecipients.length - 5;

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
                              type="button"
                              onClick={() => setShowAllInPreview(true)}
                              className="text-[11px] font-medium text-indigo-600 px-1 py-1"
                            >
                              + {remainingCount} more
                            </button>
                          )}
                          {showAllInPreview && previewRecipients.length > 5 && (
                            <button
                              type="button"
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
              <div className="mb-2 border-t border-gray-200 pt-2">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {previewSubject || "Template Subject"}
                </p>
              </div>
              <div className="overflow-hidden mx-auto rounded-md border border-indigo-200/60">
                <div
                  ref={previewViewportRef}
                  className="bg-white relative overflow-hidden"
                  style={{ height: `${iframeHeight}px` }}
                >
                  <iframe
                    title="Campaign Template Preview"
                    ref={previewIframeRef}
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
          </section>
        </main>
      </div>
    </div>
  );
};

export default CreateCampaign;
