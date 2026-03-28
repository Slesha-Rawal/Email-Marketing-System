import React, { useEffect, useState, useMemo } from "react";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  AlertCircle,
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
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [showAllInPreview, setShowAllInPreview] = useState(false);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    fetchInitialData();
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

      <div className="flex-1 ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb Pattern from other pages */}
          <nav className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
            <span>Home</span>
            <span className="text-gray-300">/</span>
            <span className="text-indigo-600">Send Emails</span>
          </nav>

          <header className="mb-10">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              Send Emails
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Configure your email options and preview your message before
              dispatching.
            </p>
          </header>

          {status.message && (
            <div
              className={`mb-8 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 border ${
                status.type === "success"
                  ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                  : "bg-rose-50 border-rose-100 text-rose-800"
              }`}
            >
              {status.type === "success" ? (
                <CheckCircle2 size={18} />
              ) : (
                <AlertCircle size={18} />
              )}
              <span className="text-sm font-semibold">{status.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-8">
            {/* Left Panel: Email Options */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 h-fit">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-lg font-bold text-gray-900">
                  Email Options
                </h3>
                <button className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 rounded-lg px-3 py-1.5 uppercase tracking-widest transition-all">
                  Add Bcc
                </button>
              </div>

              <div className="mb-10 relative">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                  To: Recipient Emails
                </label>

                <div
                  className="min-h-[50px] w-full bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 flex flex-wrap items-center gap-2 focus-within:ring-2 focus-within:ring-indigo-500/10 focus-within:border-indigo-500 transition-all shadow-sm cursor-text relative pr-10"
                  onClick={() =>
                    document.getElementById("contact-search-input")?.focus()
                  }
                >
                  <div className="flex items-center pl-1.5 text-gray-400">
                    <Users size={16} />
                  </div>

                  {/* Selected Chips inside the "field" */}
                  {selectedContactIds.map((id) => {
                    const contact = contacts.find((c) => c.contact_id === id);
                    if (!contact) return null;
                    return (
                      <div
                        key={contact.contact_id}
                        className="flex items-center gap-1.5 bg-white text-indigo-700 pl-2.5 pr-1.5 py-1 rounded-lg text-[10px] font-bold border border-indigo-100 shadow-sm animate-in zoom-in-95 duration-200"
                      >
                        <span className="truncate">
                          {contact.contact_email.length > 5
                            ? `${contact.contact_email.substring(0, 5)}...`
                            : contact.contact_email}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleContact(contact.contact_id);
                          }}
                          className="hover:bg-indigo-50 p-0.5 rounded transition-colors text-indigo-300 hover:text-indigo-600"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 10 10"
                            fill="none"
                          >
                            <path
                              d="M1 1L9 9M9 1L1 9"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
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
                    className="flex-1 min-w-[120px] bg-transparent border-none p-0 h-8 text-sm text-gray-900 focus:outline-none focus:ring-0"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />

                  {/* Clear All Icon on the right */}
                  {selectedContactIds.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedContactIds([]);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-500 transition-colors"
                      title="Clear all recipients"
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                      >
                        <path
                          d="M1 1L9 9M9 1L1 9"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Suggestions Dropdown */}
                {searchQuery.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-gray-100 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="max-h-64 overflow-y-auto p-2 custom-scrollbar">
                      {filteredContacts.length > 0 ? (
                        filteredContacts.map((contact) => (
                          <button
                            key={contact.contact_id}
                            onClick={() => {
                              if (
                                !selectedContactIds.includes(contact.contact_id)
                              ) {
                                toggleContact(contact.contact_id);
                              }
                              setSearchQuery("");
                            }}
                            className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl transition-all group ${
                              selectedContactIds.includes(contact.contact_id)
                                ? "bg-indigo-50/50 cursor-default"
                                : "hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex flex-col items-start min-w-0">
                              <span
                                className={`text-sm font-bold truncate ${
                                  selectedContactIds.includes(
                                    contact.contact_id,
                                  )
                                    ? "text-indigo-600"
                                    : "text-gray-700"
                                }`}
                              >
                                {contact.contact_name}
                              </span>
                              <span className="text-[11px] text-gray-400 truncate font-medium">
                                {contact.contact_email}
                              </span>
                            </div>
                            {selectedContactIds.includes(
                              contact.contact_id,
                            ) && (
                              <div className="bg-indigo-100 text-indigo-600 rounded-full p-1">
                                <CheckCircle2 size={14} />
                              </div>
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="py-12 text-center font-bold text-gray-400 italic">
                          No matching contacts
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <hr className="border-t border-gray-100 mb-8" />

              <div className="text-[11px] font-bold text-gray-400 mb-6 uppercase tracking-[0.08em]">
                Email Template Information
              </div>

              <div className="mb-10">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                  Select Template
                </label>
                <div className="relative">
                  <select
                    className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer"
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                  >
                    <option value="" disabled>
                      Select Template
                    </option>
                    {templates.map((template) => (
                      <option
                        key={template.template_id}
                        value={template.template_id}
                      >
                        {template.template_name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                      <path
                        d="M1 1L5 5L9 1"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <button
                className="w-full bg-indigo-600 text-white rounded-xl py-4 text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                onClick={handleSendEmail}
                disabled={
                  loading ||
                  !selectedTemplateId ||
                  selectedContactIds.length === 0
                }
              >
                <Send size={16} />
                {loading ? "Sending..." : "Send Email"}
              </button>
            </div>

            {/* Right Panel: Preview */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 flex flex-col h-full min-h-[500px]">
              <div className="flex items-center gap-3 text-sm font-bold text-gray-900 border-b border-gray-100 pb-5 mb-6">
                <Eye className="text-indigo-500" size={18} />
                Live Preview
              </div>

              <div className="flex gap-3 mb-6 items-baseline pb-4 border-b border-gray-50">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest min-w-[32px]">
                  To:
                </span>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
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
                              className="text-[11px] font-bold text-indigo-600 bg-indigo-50/50 px-3 py-1 rounded-lg animate-in zoom-in-95 duration-200"
                            >
                              {contact.contact_email}
                            </span>
                          ))}
                          {remainingCount > 0 && !showAllInPreview && (
                            <button
                              onClick={() => setShowAllInPreview(true)}
                              className="text-[11px] font-bold text-indigo-400 hover:text-indigo-600 px-2 py-1 transition-colors"
                            >
                              + {remainingCount} more
                            </button>
                          )}
                          {showAllInPreview && selectedContacts.length > 5 && (
                            <button
                              onClick={() => setShowAllInPreview(false)}
                              className="text-[11px] font-bold text-indigo-400 hover:text-indigo-600 px-2 py-1 transition-colors"
                            >
                              Show less
                            </button>
                          )}
                        </>
                      );
                    })()
                  ) : (
                    <span className="text-sm font-semibold text-gray-300 italic px-3 py-1">
                      No recipients selected
                    </span>
                  )}
                </div>
              </div>

              {selectedTemplate ? (
                <div className="animate-in fade-in duration-500 flex flex-col flex-1">
                  <div className="mb-4">
                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest block mb-1">
                      Subject Line
                    </span>
                    <div className="text-sm font-bold text-gray-900 pb-4 border-b border-gray-50 mb-6">
                      {selectedTemplate.template_subject}
                    </div>
                  </div>
                  <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl overflow-hidden shadow-inner relative min-h-[400px]">
                    <iframe
                      title="Template Preview"
                      srcDoc={selectedTemplate.template_body}
                      className="w-full h-full border-none bg-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-20 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                  <div className="w-20 h-20 rounded-[28px] bg-white shadow-sm border border-gray-100 flex items-center justify-center mb-6">
                    <FileText className="text-indigo-200" size={32} />
                  </div>
                  <h4 className="text-lg font-bold text-gray-400">
                    No Template Selected
                  </h4>
                  <p className="text-xs text-gray-400 mt-2">
                    Pick a template from the options to preview its layout
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SendEmails;
