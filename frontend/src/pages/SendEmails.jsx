import React, { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Eye,
  Users,
  FileText,
  Send,
} from "lucide-react";

const SendEmails = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [templates, setTemplates] = useState([]);

  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRecipientsDropdownOpen, setIsRecipientsDropdownOpen] =
    useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const [showAllInPreview, setShowAllInPreview] = useState(false);
  const templateDropdownRef = useRef(null);
  const recipientsDropdownRef = useRef(null);
  const [showRequiredHints, setShowRequiredHints] = useState(false);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

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
      setStatus({ type: "error", message: "Failed to load initial data" });
    }
  };

  const filteredContacts = useMemo(() => {
    if (!searchQuery) return contacts;
    const query = searchQuery.toLowerCase();
    return contacts.filter(
      (c) =>
        (c.contact_name || "").toLowerCase().includes(query) ||
        (c.contact_email || "").toLowerCase().includes(query),
    );
  }, [contacts, searchQuery]);

  const toggleContact = (contactId) => {
    setSelectedContactIds((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId],
    );
  };

  const handleSendEmail = async () => {
    setShowRequiredHints(true);

    if (!selectedTemplateId) {
      setStatus({ type: "error", message: "Please select a template" });
      return;
    }

    if (selectedContactIds.length === 0) {
      setStatus({
        type: "error",
        message: "Please select at least one contact",
      });
      return;
    }

    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      const template = templates.find(
        (t) => t.template_id === Number(selectedTemplateId),
      );
      if (!template) throw new Error("Template not found");

      const contactSegment = `ids:${selectedContactIds.join(",")}`;

      const campaignPayload = {
        campaign_name: `Quick Send - ${new Date().toLocaleString()}`,
        campaign_subject: template.template_subject || "No Subject",
        campaign_body: template.template_body || "",
        template_id: template.template_id,
        sender_name: user?.name || "System",
        sender_email: user?.email || "noreply@example.com",
        contact_segment: contactSegment,
        campaign_status: "draft",
      };

      const createRes = await api.post("/campaigns", campaignPayload);
      const campaignId = createRes.data.id;

      await api.post(`/campaigns/${campaignId}/send`);

      setStatus({ type: "success", message: "Emails sent successfully!" });
      setSelectedTemplateId("");
      setSelectedContactIds([]);
      setSearchQuery("");
      setShowRequiredHints(false);
      navigate("/email-logs");
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error.response?.data?.message ||
          error.message ||
          "Failed to send emails",
      });
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
      const selectedEmails = contacts
        .filter((c) => selectedContactIds.includes(c.contact_id))
        .map((c) => c.contact_email);
      return selectedEmails.join(", ");
    }
    return "No recipients selected";
  }, [selectedContactIds, contacts]);

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

          {status.message && (
            <div
              className={`mb-5 rounded-lg border px-4 py-3 text-sm flex items-center gap-2 ${
                status.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {status.type === "success" ? (
                <CheckCircle2 size={16} />
              ) : (
                <AlertCircle size={16} />
              )}
              <span className="font-medium">{status.message}</span>
            </div>
          )}

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-5 items-start">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5 space-y-5">
              <h2 className="text-sm font-semibold text-gray-800">
                Email Options
              </h2>

              <div className="space-y-5">
                <div className="relative" ref={recipientsDropdownRef}>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    To
                  </label>
                  <div
                    className={`min-h-11 relative rounded-lg border bg-white transition-all px-2.5 py-2 flex flex-wrap items-center gap-2 pr-10 ${
                      isRecipientsMissing
                        ? "border-red-400 focus-within:border-red-500"
                        : "border-gray-200 focus-within:border-indigo-300"
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
                    <div className="absolute z-30 left-0 right-0 mt-2 bg-white border border-gray-200 shadow-lg rounded-lg overflow-hidden">
                      <div className="max-h-64 overflow-y-auto p-2">
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
                              className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left text-sm ${
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

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Select Template
                  </label>
                  <div ref={templateDropdownRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setIsTemplateDropdownOpen((prev) => !prev)}
                      className={`w-full rounded-lg border bg-white px-3 py-2.5 text-left text-sm text-gray-700 transition-all focus:outline-none flex items-center justify-between ${
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
                      <div className="absolute z-40 mt-2 w-full rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                        <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
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
                                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
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
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleSendEmail}
                    disabled={loading}
                  >
                    <Send size={16} />
                    {loading ? "Sending..." : "Send Email"}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 lg:p-4">
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

              {selectedTemplate ? (
                <div>
                  <div className="mb-2 border-t border-gray-200 pt-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {selectedTemplate.template_subject}
                    </p>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-gray-200 h-160">
                    <iframe
                      title="Template Preview"
                      srcDoc={selectedTemplate.template_body}
                      className="w-full h-full border-none bg-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="h-160 flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50">
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
