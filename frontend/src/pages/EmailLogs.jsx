import React, { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";
import Pagination from "../components/Pagination.jsx";
import defaultAvatar from "../assets/default-avatar.svg";
import DateRangeFilter from "../components/contacts/DateRangeFilter.jsx";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Search,
  Users,
  X,
} from "lucide-react";

const DELIVERY_STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "sent", label: "Sent" },
  { value: "pending", label: "Pending" },
];

const avatarToneClasses = [
  "bg-indigo-50 text-indigo-700",
  "bg-sky-50 text-sky-700",
  "bg-emerald-50 text-emerald-700",
  "bg-amber-50 text-amber-700",
  "bg-rose-50 text-rose-700",
];

const getInitials = (name = "") => {
  const cleanName = String(name).trim();
  if (!cleanName) {
    return "?";
  }

  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
};

const resolveAvatarUrl = (value) => {
  const source = String(value || "").trim();

  if (!source) {
    return "";
  }

  if (source.startsWith("http://") || source.startsWith("https://")) {
    return source;
  }

  const baseUrl = String(api.defaults.baseURL || "").trim();
  const origin = baseUrl.replace(/\/api\/?$/, "");
  const normalizedPath = source.startsWith("/") ? source : `/${source}`;
  return `${origin}${normalizedPath}`;
};

const EmailLogs = () => {
  const [logs, setLogs] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [templateFilter, setTemplateFilter] = useState("");
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [recipientFilter, setRecipientFilter] = useState("");
  const [selectedRecipientIds, setSelectedRecipientIds] = useState([]);
  const [isRecipientsDropdownOpen, setIsRecipientsDropdownOpen] =
    useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [recipientModalLog, setRecipientModalLog] = useState(null);
  const [recipientModalSearch, setRecipientModalSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const templateDropdownRef = useRef(null);
  const statusDropdownRef = useRef(null);
  const recipientsDropdownRef = useRef(null);
  const dateMenuRef = useRef(null);
  const tableRef = useRef(null);

  useEffect(() => {
    fetchContacts();
    fetchTemplates();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [
    templateFilter,
    statusFilter,
    recipientFilter,
    selectedRecipientIds,
    contacts,
    dateFrom,
    dateTo,
  ]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        templateDropdownRef.current &&
        !templateDropdownRef.current.contains(event.target)
      ) {
        setIsTemplateDropdownOpen(false);
      }

      if (
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(event.target)
      ) {
        setIsStatusDropdownOpen(false);
      }

      if (
        recipientsDropdownRef.current &&
        !recipientsDropdownRef.current.contains(event.target)
      ) {
        setIsRecipientsDropdownOpen(false);
      }

      if (dateMenuRef.current && !dateMenuRef.current.contains(event.target)) {
        setIsDateMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const fetchContacts = async () => {
    try {
      const res = await api.get("/contacts");
      const nextContacts = Array.isArray(res.data) ? res.data : [];
      setContacts(nextContacts);
    } catch (e) {
      setContacts([]);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await api.get("/templates");
      setTemplates(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setTemplates([]);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (templateFilter) params.template = templateFilter;
      if (statusFilter) params.status = statusFilter;
      if (recipientFilter.trim()) params.recipient = recipientFilter.trim();
      const res = await api.get("/email-logs", { params });
      const apiRows = Array.isArray(res.data) ? res.data : [];

      let nextRows = apiRows;

      if (selectedRecipientIds.length > 0) {
        const selectedContacts = contacts.filter((contact) =>
          selectedRecipientIds.includes(contact.contact_id),
        );

        const matchTokens = selectedContacts
          .flatMap((contact) => [contact.contact_name, contact.contact_email])
          .map((value) =>
            String(value || "")
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean);

        const filteredRows = nextRows.filter((row) => {
          const recipientHaystack = String(
            row.recipient_names || "",
          ).toLowerCase();
          return matchTokens.some((token) => recipientHaystack.includes(token));
        });

        nextRows = filteredRows;
      }

      if (statusFilter) {
        nextRows = nextRows.filter(
          (row) => String(row.send_status || "").toLowerCase() === statusFilter,
        );
      }

      if (dateFrom || dateTo) {
        const start = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
        const end = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;

        nextRows = nextRows.filter((row) => {
          const sentAt = new Date(row.sent_at);
          if (Number.isNaN(sentAt.getTime())) {
            return false;
          }

          if (start && sentAt < start) {
            return false;
          }

          if (end && sentAt > end) {
            return false;
          }

          return true;
        });
      }

      setLogs(nextRows);
    } catch (e) {
      setError(e.response?.data?.message || "Failed to load email logs");
    } finally {
      setLoading(false);
    }
  };

  const filteredRecipients = useMemo(() => {
    const baseContacts = contacts.filter(
      (contact) => contact.contact_status === "active",
    );

    if (!recipientFilter.trim()) {
      return baseContacts;
    }

    const query = recipientFilter.trim().toLowerCase();
    return baseContacts.filter(
      (contact) =>
        String(contact.contact_name || "")
          .toLowerCase()
          .includes(query) ||
        String(contact.contact_email || "")
          .toLowerCase()
          .includes(query),
    );
  }, [contacts, recipientFilter]);

  const selectedTemplateName = useMemo(() => {
    if (!templateFilter) {
      return "All";
    }

    const selected = templates.find(
      (item) => String(item.template_id) === String(templateFilter),
    );
    return selected?.template_name || "All";
  }, [templateFilter, templates]);

  const selectedStatusName = useMemo(() => {
    const selectedOption = DELIVERY_STATUS_OPTIONS.find(
      (option) => option.value === statusFilter,
    );
    return selectedOption?.label || "All";
  }, [statusFilter]);

  const selectedDateLabel =
    dateFrom || dateTo
      ? `${dateFrom || "Start"} - ${dateTo || "End"}`
      : "Added Date";

  const toggleRecipient = (contactId) => {
    setSelectedRecipientIds((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId],
    );
  };

  const getAvatarTone = (seedValue) => {
    const seed = String(seedValue || "");
    const hash = seed
      .split("")
      .reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return avatarToneClasses[hash % avatarToneClasses.length];
  };

  const getLogRecipientEntries = (log) => {
    const names = String(log.recipient_names || "")
      .split("||")
      .map((item) => item.trim())
      .filter(Boolean);
    const emails = String(log.recipient_emails || "")
      .split("||")
      .map((item) => item.trim())
      .filter(Boolean);

    const maxLength = Math.max(names.length, emails.length);
    const entries = [];

    for (let index = 0; index < maxLength; index += 1) {
      const email = emails[index] || "";
      const name = names[index] || email || "Unknown";
      if (!email && !name) {
        continue;
      }

      entries.push({ name, email });
    }

    return entries;
  };

  const closeRecipientModal = () => {
    setRecipientModalLog(null);
    setRecipientModalSearch("");
  };

  const renderRecipientBadges = (log) => {
    const recipients = getLogRecipientEntries(log);

    const totalRecipients = Number(log.total_recipients);
    const boundedRecipients =
      Number.isFinite(totalRecipients) && totalRecipients > 0
        ? recipients.slice(0, totalRecipients)
        : recipients;

    if (boundedRecipients.length === 0) {
      return <span className="text-gray-400">-</span>;
    }

    const visibleRecipients = boundedRecipients.slice(0, 3);
    const remainingCount = boundedRecipients.length - visibleRecipients.length;

    return (
      <button
        type="button"
        onClick={() => setRecipientModalLog(log)}
        className="flex items-center"
        title={boundedRecipients
          .map((entry) => entry.email || entry.name)
          .join(", ")}
      >
        {visibleRecipients.map((entry, index) => (
          <div
            key={`${log.id}-${entry.email || entry.name}-${index}`}
            className={`h-10 w-10 rounded-full border-2 border-white text-sm font-semibold flex items-center justify-center ${getAvatarTone(
              entry.email || entry.name,
            )} ${index === 0 ? "ml-0" : "-ml-2"}`}
          >
            {getInitials(entry.name)}
          </div>
        ))}
        {remainingCount > 0 && (
          <div className="-ml-2 h-10 w-10 rounded-full border-2 border-white bg-gray-100 text-gray-700 text-sm font-semibold flex items-center justify-center">
            +{remainingCount}
          </div>
        )}
      </button>
    );
  };

  const modalRecipients = useMemo(() => {
    if (!recipientModalLog) {
      return [];
    }

    const baseRecipients = getLogRecipientEntries(recipientModalLog);
    if (!recipientModalSearch.trim()) {
      return baseRecipients;
    }

    const query = recipientModalSearch.trim().toLowerCase();
    return baseRecipients.filter((entry) =>
      String(entry.email || "")
        .toLowerCase()
        .includes(query),
    );
  }, [recipientModalLog, recipientModalSearch]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <div className="p-8 max-w-7xl mx-auto w-full">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Email Logs</h1>
            <p className="mt-1 text-sm text-gray-500">
              View all sent emails, filter by date, template, or recipient.
            </p>
          </header>

          <div className="flex flex-nowrap gap-2 mb-8 items-end overflow-x-auto">
            <div ref={templateDropdownRef} className="relative min-w-52">
              <label className="block text-xs text-gray-500 mb-1">
                Template
              </label>
              <button
                type="button"
                onClick={() => setIsTemplateDropdownOpen((prev) => !prev)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-left text-sm text-gray-700 transition-all focus:outline-none focus:border-indigo-300 flex items-center justify-between"
              >
                <span className="truncate">{selectedTemplateName}</span>
                {isTemplateDropdownOpen ? (
                  <ChevronUp className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                )}
              </button>

              {isTemplateDropdownOpen && (
                <div className="absolute z-40 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                  <div className="slim-scrollbar max-h-72 overflow-y-auto space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setTemplateFilter("");
                        setIsTemplateDropdownOpen(false);
                      }}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        !templateFilter
                          ? "bg-indigo-50 text-indigo-700 font-medium"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      All
                    </button>
                    {templates.map((template) => {
                      const isSelected =
                        String(template.template_id) === String(templateFilter);

                      return (
                        <button
                          key={template.template_id}
                          type="button"
                          onClick={() => {
                            setTemplateFilter(String(template.template_id));
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
                    })}
                  </div>
                </div>
              )}
            </div>

            <div ref={statusDropdownRef} className="relative min-w-44">
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <button
                type="button"
                onClick={() => setIsStatusDropdownOpen((prev) => !prev)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-left text-sm text-gray-700 transition-all focus:outline-none focus:border-indigo-300 flex items-center justify-between"
              >
                <span className="truncate">{selectedStatusName}</span>
                {isStatusDropdownOpen ? (
                  <ChevronUp className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                )}
              </button>

              {isStatusDropdownOpen && (
                <div className="absolute z-40 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                  <div className="slim-scrollbar max-h-72 overflow-y-auto space-y-1">
                    {DELIVERY_STATUS_OPTIONS.map((option) => {
                      const isSelected = option.value === statusFilter;
                      return (
                        <button
                          key={option.value || "all"}
                          type="button"
                          onClick={() => {
                            setStatusFilter(option.value);
                            setIsStatusDropdownOpen(false);
                          }}
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

            <div ref={recipientsDropdownRef} className="relative flex-1">
              <label className="block text-xs text-gray-500 mb-1">
                Recipient
              </label>
              <div
                className="min-h-10 relative rounded-lg border border-gray-200 bg-white transition-all px-2.5 py-1.5 flex flex-wrap items-center gap-2 pr-10 focus-within:border-indigo-300"
                onClick={() => {
                  setIsRecipientsDropdownOpen(true);
                  document
                    .getElementById("email-log-recipient-search")
                    ?.focus();
                }}
              >
                <div className="flex items-center text-gray-400">
                  <Users size={15} />
                </div>

                {selectedRecipientIds.map((id) => {
                  const contact = contacts.find(
                    (item) => item.contact_id === id,
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
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleRecipient(contact.contact_id);
                        }}
                        className="text-indigo-400 hover:text-indigo-700"
                      >
                        x
                      </button>
                    </div>
                  );
                })}

                <input
                  id="email-log-recipient-search"
                  type="text"
                  value={recipientFilter}
                  onChange={(e) => setRecipientFilter(e.target.value)}
                  onFocus={() => setIsRecipientsDropdownOpen(true)}
                  placeholder={
                    selectedRecipientIds.length === 0
                      ? "Type name or email address..."
                      : ""
                  }
                  className="flex-1 min-w-30 bg-transparent border-none p-0 h-7 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
                />

                {selectedRecipientIds.length > 0 && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedRecipientIds([]);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    title="Clear selected recipients"
                  >
                    x
                  </button>
                )}
              </div>

              {isRecipientsDropdownOpen && (
                <div className="absolute z-30 left-0 right-0 mt-2 bg-white border border-gray-200 shadow-lg rounded-lg overflow-hidden">
                  <div className="slim-scrollbar max-h-64 overflow-y-auto">
                    {filteredRecipients.length > 0 ? (
                      filteredRecipients.map((contact) => {
                        const isSelected = selectedRecipientIds.includes(
                          contact.contact_id,
                        );

                        return (
                          <button
                            key={contact.contact_id}
                            type="button"
                            onClick={() => {
                              toggleRecipient(contact.contact_id);
                              setRecipientFilter("");
                              setIsRecipientsDropdownOpen(true);
                            }}
                            className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left text-sm ${
                              isSelected
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
            <div className="relative min-w-64">
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <DateRangeFilter
                menuRef={dateMenuRef}
                isOpen={isDateMenuOpen}
                onToggle={() => setIsDateMenuOpen((prev) => !prev)}
                selectedLabel={selectedDateLabel}
                isRangeActive={Boolean(dateFrom || dateTo)}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateRangeChange={({ from, to }) => {
                  setDateFrom(from);
                  setDateTo(to);
                }}
                onClear={() => {
                  setDateFrom("");
                  setDateTo("");
                  setIsDateMenuOpen(false);
                }}
                align="right"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-md border border-indigo-200/60 bg-white">
            <table className="w-full text-sm" ref={tableRef}>
              <thead className="bg-gray-100 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    Sent At
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    Campaigns
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    Sent By
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    Recipients
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    Success
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    Pending
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    Failed
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/70">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-400">
                      Loading...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-400">
                      No email logs found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap align-top">
                        {log.sent_at ? (
                          <div className="flex flex-col leading-snug text-gray-900">
                            <span>
                              {new Date(log.sent_at).toLocaleDateString(
                                "en-GB",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                },
                              )}
                              ,
                            </span>
                            <span>
                              {new Date(log.sent_at).toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-normal align-top">
                        <div className="max-w-xs wrap-break-word text-gray-900 leading-snug">
                          {log.campaign_display_name ||
                            log.campaign_name ||
                            "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap align-top">
                        <div className="flex items-center gap-2">
                          <img
                            src={
                              log.sent_by_avatar_url
                                ? resolveAvatarUrl(log.sent_by_avatar_url)
                                : defaultAvatar
                            }
                            alt={
                              log.sent_by
                                ? `${log.sent_by} avatar`
                                : "Default avatar"
                            }
                            className="h-8 w-8 rounded-full object-cover"
                          />
                          <span>{log.sent_by || "-"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 min-w-45">
                        {renderRecipientBadges(log)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-900 font-semibold">
                        {log.success_count ?? 0}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-900 font-semibold">
                        {log.pending_count ?? 0}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-900 font-semibold">
                        {log.fail_count ?? 0}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap align-top">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            log.send_status === "pending"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {log.send_status === "pending" ? "Pending" : "Sent"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {!loading && logs.length > 0 && (
              <Pagination
                tableRef={tableRef}
                options={[15, 30, 50]}
                footerRadiusClass="rounded-b-md"
              />
            )}
          </div>
        </div>
      </div>

      {recipientModalLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Recipients
                </h3>
                <p className="text-xs text-gray-500">
                  {recipientModalLog.campaign_display_name ||
                    recipientModalLog.campaign_name ||
                    "-"}{" "}
                  ({recipientModalLog.total_recipients || 0})
                </p>
              </div>
              <button
                type="button"
                onClick={closeRecipientModal}
                className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4">
              <div className="relative rounded-lg border border-gray-200 bg-white transition-all focus-within:border-indigo-300">
                <input
                  type="text"
                  placeholder="Search by email"
                  value={recipientModalSearch}
                  onChange={(event) =>
                    setRecipientModalSearch(event.target.value)
                  }
                  className="w-full rounded-lg border-none bg-transparent px-3 py-2.5 pr-10 text-sm text-gray-700 placeholder:text-gray-500 focus:outline-none"
                />
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto border-t border-gray-100 px-5 py-3">
              {modalRecipients.length === 0 ? (
                <p className="py-6 text-sm text-gray-500">
                  No recipients found.
                </p>
              ) : (
                <ul className="space-y-2">
                  {modalRecipients.map((entry, index) => (
                    <li
                      key={`${entry.email || entry.name}-${index}`}
                      className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold ${getAvatarTone(
                            entry.email || entry.name,
                          )}`}
                        >
                          {getInitials(entry.name)}
                        </span>
                        <span className="text-sm text-gray-800">
                          {entry.name}
                        </span>
                      </div>
                      <span className="text-sm text-gray-600">
                        {entry.email || "-"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailLogs;
