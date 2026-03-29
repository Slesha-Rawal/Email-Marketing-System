import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const FIXED_SENDER_NAME = "HomeSchool.Asia";
const MIN_PREVIEW_HEIGHT = 240;
const MAX_PREVIEW_HEIGHT = 1400;

const initialFormData = {
  campaign_name: "",
  template_id: "",
  campaign_subject: "",
  campaign_body: "",
  contact_segment: "all",
  schedule_option: "sent",
  scheduled_date: "",
};

const hasUnsubscribeMarkup = (html = "") =>
  /(\{\{\s*unsubscribe_url\s*\}\}|\/unsubscribe\b|>\s*unsubscribe\s*<)/i.test(
    String(html || ""),
  );

const CreateCampaign = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const editingCampaign = location.state?.campaign;

  const [formData, setFormData] = useState(initialFormData);
  const [templates, setTemplates] = useState([]);
  const [groups, setGroups] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [previewRecipients, setPreviewRecipients] = useState([]);
  const [showAllInPreview, setShowAllInPreview] = useState(false);
  const [error, setError] = useState("");
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const [isRecipientsDropdownOpen, setIsRecipientsDropdownOpen] =
    useState(false);
  const [isDeliveryDropdownOpen, setIsDeliveryDropdownOpen] = useState(false);
  const templateDropdownRef = useRef(null);
  const recipientsDropdownRef = useRef(null);
  const deliveryDropdownRef = useRef(null);
  const previewViewportRef = useRef(null);
  const previewIframeRef = useRef(null);
  const [iframeHeight, setIframeHeight] = useState(500);
  const [iframeScale, setIframeScale] = useState(1);
  const [iframeContentHeight, setIframeContentHeight] = useState(500);
  const [iframeContentWidth, setIframeContentWidth] = useState(700);

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
    if (!editingCampaign) {
      return;
    }

    const status = String(
      editingCampaign.campaign_status || "draft",
    ).toLowerCase();

    setFormData({
      campaign_name: editingCampaign.campaign_name || "",
      template_id: editingCampaign.template_id || "",
      campaign_subject: editingCampaign.campaign_subject || "",
      campaign_body: editingCampaign.campaign_body || "",
      contact_segment: editingCampaign.contact_segment || "all",
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
  }, [editingCampaign]);

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
    setFormData((prev) => ({
      ...prev,
      contact_segment: value,
    }));
    setIsRecipientsDropdownOpen(false);
  };

  const handleDeliverySelect = (value) => {
    setFormData((prev) => ({
      ...prev,
      schedule_option: value,
    }));
    setIsDeliveryDropdownOpen(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

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
      setError(`Please fill required fields: ${missingFields.join(", ")}`);
      return;
    }

    if (formData.schedule_option === "scheduled" && !formData.scheduled_date) {
      setError("Select a schedule date for scheduled campaigns");
      return;
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
      sender_name: FIXED_SENDER_NAME,
      reply_to_email: "",
      sender_email: String(user?.email || "noreply@example.com")
        .trim()
        .toLowerCase(),
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
    "relative rounded-lg border border-gray-200 bg-white transition-all focus-within:border-indigo-300";
  const shellInputClass =
    "w-full rounded-lg border-none bg-transparent px-3 py-2.5 text-sm text-gray-700 placeholder:text-gray-500 focus:outline-none";
  const selectedTemplate = templates.find(
    (template) => String(template.template_id) === String(formData.template_id),
  );
  const selectedTemplateName = selectedTemplate
    ? selectedTemplate.template_name
    : "Select Template";
  const selectedRecipientsLabel =
    formData.contact_segment === "all"
      ? "All Contacts"
      : (() => {
          const selectedGroup = groups.find(
            (group) => `group:${group.group_id}` === formData.contact_segment,
          );
          return selectedGroup
            ? `Group: ${selectedGroup.group_name}`
            : "Select Recipients";
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
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-5 items-start">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-5">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                {editingCampaign ? "Edit Campaign" : "Create Campaign"}
              </h1>
              <p className="text-sm text-gray-500">
                Configure campaign basics before sending.
              </p>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 gap-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Campaign Name
                    </label>
                    <div className={shellWrapperClass}>
                      <input
                        type="text"
                        name="campaign_name"
                        value={formData.campaign_name}
                        onChange={handleInputChange}
                        className={shellInputClass}
                        placeholder="Enter campaign name"
                      />
                    </div>
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
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left text-sm text-gray-700 transition-all focus:outline-none focus:border-indigo-300 flex items-center justify-between"
                      >
                        <span className="truncate">{selectedTemplateName}</span>
                        {isTemplateDropdownOpen ? (
                          <ChevronUp className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        )}
                      </button>

                      {isTemplateDropdownOpen && (
                        <div className="absolute z-40 mt-2 w-full rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                          <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                            <button
                              type="button"
                              onClick={() => handleTemplateSelect("")}
                              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
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
                                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
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
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Select Recipients
                    </label>
                    <div ref={recipientsDropdownRef} className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setIsRecipientsDropdownOpen((prev) => !prev)
                        }
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left text-sm text-gray-700 transition-all focus:outline-none focus:border-indigo-300 flex items-center justify-between"
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
                        <div className="absolute z-40 mt-2 w-full rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                          <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                            <button
                              type="button"
                              onClick={() => handleRecipientsSelect("all")}
                              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                formData.contact_segment === "all"
                                  ? "bg-indigo-50 text-indigo-700 font-medium"
                                  : "text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              All Contacts
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
                                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                    isSelected
                                      ? "bg-indigo-50 text-indigo-700 font-medium"
                                      : "text-gray-700 hover:bg-gray-50"
                                  }`}
                                >
                                  Group: {group.group_name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

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
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left text-sm text-gray-700 transition-all focus:outline-none focus:border-indigo-300 flex items-center justify-between"
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
                        <div className="absolute z-40 mt-2 w-full rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
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
                                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
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
                      <div className={shellWrapperClass}>
                        <input
                          type="datetime-local"
                          name="scheduled_date"
                          value={formData.scheduled_date}
                          onChange={handleInputChange}
                          className={shellInputClass}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => navigate("/campaigns")}
                    className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    {editingCampaign ? "Update" : "Save"}
                    <ArrowRight size={18} />
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 lg:p-4">
              <div className="mb-3 inline-flex items-center gap-2 text-sm text-gray-700 font-medium">
                Preview
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
              <div className="mb-2 border-t border-gray-200 pt-2">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {previewSubject || "Template Subject"}
                </p>
              </div>
              <div className="overflow-hidden mx-auto rounded-lg border border-gray-200">
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
