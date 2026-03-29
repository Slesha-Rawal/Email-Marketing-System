import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  Edit2,
  Plus,
  Search,
  Trash2,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import Pagination from "../Pagination.jsx";
import api from "../../lib/api.js";

function GroupContactsTab({
  canManageContacts,
  groups,
  selectedGroupId,
  onSelectGroup,
  selectedGroup,
  groupError,
  onCreateGroup,
  onDeleteGroup,
  availableContacts,
  selectedContactIds,
  onToggleSelectedContact,
  onAssignContacts,
  groupContacts,
  onRemoveFromGroup,
  onUpdateGroup,
  onEditContact,
  onDeleteContact,
  onClearSelectedContacts,
}) {
  const tableRef = useRef(null);
  const [viewMode, setViewMode] = useState("list"); // list or details
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [editingGroup, setEditingGroup] = useState(null);
  const [dialogError, setDialogError] = useState("");
  const [groupSearchMeta, setGroupSearchMeta] = useState({});
  const [groupStatusFilter, setGroupStatusFilter] = useState("all");
  const [groupAddedDateFilter, setGroupAddedDateFilter] = useState("all");
  const [groupDateFrom, setGroupDateFrom] = useState("");
  const [groupDateTo, setGroupDateTo] = useState("");
  const [groupDetailSearchTerm, setGroupDetailSearchTerm] = useState("");
  const [groupListSearchTerm, setGroupListSearchTerm] = useState("");
  const [isGroupStatusMenuOpen, setIsGroupStatusMenuOpen] = useState(false);
  const [isGroupDateMenuOpen, setIsGroupDateMenuOpen] = useState(false);
  const [showQuickAddDialog, setShowQuickAddDialog] = useState(false);
  const [quickAddSearchQuery, setQuickAddSearchQuery] = useState("");
  const [isQuickAddDropdownOpen, setIsQuickAddDropdownOpen] = useState(false);
  const [quickAddError, setQuickAddError] = useState("");
  const groupStatusMenuRef = useRef(null);
  const groupDateMenuRef = useRef(null);
  const quickAddDropdownRef = useRef(null);

  const filteredAvailableContacts = useMemo(() => {
    if (!quickAddSearchQuery.trim()) {
      return availableContacts;
    }

    const query = quickAddSearchQuery.toLowerCase();
    return availableContacts.filter(
      (contact) =>
        (contact.contact_name || "").toLowerCase().includes(query) ||
        (contact.contact_email || "").toLowerCase().includes(query),
    );
  }, [availableContacts, quickAddSearchQuery]);

  const normalizedGroupSearchTerm = groupListSearchTerm.trim().toLowerCase();

  useEffect(() => {
    let cancelled = false;

    const loadGroupSearchMeta = async (targetGroups) => {
      if (viewMode !== "list" || targetGroups.length === 0) {
        return;
      }

      const metaResults = await Promise.allSettled(
        targetGroups.map(async (group) => {
          const response = await api.get(
            `/contact-groups/${group.group_id}/contacts`,
          );
          const previewContacts = response.data
            .map((contact) => ({
              contact_name: contact.contact_name,
              contact_email: contact.contact_email,
            }))
            .slice(0, 3);

          const searchableText = response.data
            .map(
              (contact) =>
                `${contact.contact_name || ""} ${contact.contact_email || ""}`,
            )
            .join(" ")
            .toLowerCase();

          return [group.group_id, { previewContacts, searchableText }];
        }),
      );

      if (!cancelled) {
        setGroupSearchMeta((prev) => {
          const next = { ...prev };
          metaResults.forEach((result) => {
            if (result.status === "fulfilled") {
              const [groupId, meta] = result.value;
              next[groupId] = meta;
            }
          });
          return next;
        });
      }
    };

    if (groups.length === 0) {
      setGroupSearchMeta({});
    } else {
      loadGroupSearchMeta(groups);
    }

    return () => {
      cancelled = true;
    };
  }, [groups, viewMode]);

  useEffect(() => {
    let cancelled = false;

    const loadMissingSearchMeta = async () => {
      if (viewMode !== "list" || !normalizedGroupSearchTerm) {
        return;
      }

      const missingGroups = groups.filter((group) => {
        const meta = groupSearchMeta[group.group_id];
        return !meta && Number(group.contacts_count) > 0;
      });

      if (missingGroups.length === 0) {
        return;
      }

      const missingResults = await Promise.allSettled(
        missingGroups.map(async (group) => {
          const response = await api.get(
            `/contact-groups/${group.group_id}/contacts`,
          );
          const previewContacts = response.data
            .map((contact) => ({
              contact_name: contact.contact_name,
              contact_email: contact.contact_email,
            }))
            .slice(0, 3);

          const searchableText = response.data
            .map(
              (contact) =>
                `${contact.contact_name || ""} ${contact.contact_email || ""}`,
            )
            .join(" ")
            .toLowerCase();

          return [group.group_id, { previewContacts, searchableText }];
        }),
      );

      if (!cancelled) {
        setGroupSearchMeta((prev) => {
          const next = { ...prev };
          missingResults.forEach((result) => {
            if (result.status === "fulfilled") {
              const [groupId, meta] = result.value;
              next[groupId] = meta;
            }
          });
          return next;
        });
      }
    };

    loadMissingSearchMeta();

    return () => {
      cancelled = true;
    };
  }, [groups, groupSearchMeta, normalizedGroupSearchTerm, viewMode]);

  const getContactInitials = (contactName, contactEmail) => {
    const nameTokens = (contactName || "").trim().split(/\s+/).filter(Boolean);

    if (nameTokens.length >= 2) {
      const firstInitial = nameTokens[0][0] || "";
      const lastInitial = nameTokens[nameTokens.length - 1][0] || "";
      return `${firstInitial}${lastInitial}`.toUpperCase();
    }

    if (nameTokens.length === 1 && nameTokens[0].length >= 2) {
      return nameTokens[0].slice(0, 2).toUpperCase();
    }

    if (!contactEmail) {
      return "NA";
    }

    const localPart = contactEmail.split("@")[0] || "";
    const tokens = localPart
      .split(/[._-]+/)
      .map((token) => token.trim())
      .filter(Boolean);

    if (tokens.length >= 2) {
      return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
    }

    const compact = (tokens[0] || localPart).replace(/[^a-zA-Z0-9]/g, "");
    return compact.slice(0, 2).toUpperCase() || "NA";
  };

  const previewBadgeTones = [
    "bg-indigo-100 text-indigo-700",
    "bg-sky-100 text-sky-700",
    "bg-emerald-100 text-emerald-700",
  ];

  const contactAvatarTones = [
    "bg-indigo-50 text-indigo-700",
    "bg-sky-50 text-sky-700",
    "bg-emerald-50 text-emerald-700",
    "bg-amber-50 text-amber-700",
    "bg-rose-50 text-rose-700",
  ];

  const groupStatusOptions = [
    { value: "all", label: "Select Status" },
    { value: "active", label: "Active" },
    { value: "unsubscribed", label: "Unsubscribed" },
    { value: "bounced", label: "Bounced" },
  ];

  const groupDateOptions = [
    { value: "all", label: "Added Date" },
    { value: "today", label: "Today" },
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "oldest", label: "Oldest first" },
    { value: "range", label: "Custom range" },
  ];

  const selectedGroupStatusLabel =
    groupStatusOptions.find((option) => option.value === groupStatusFilter)
      ?.label || "Select Status";

  const selectedGroupDateLabel =
    groupAddedDateFilter === "range" && (groupDateFrom || groupDateTo)
      ? `${groupDateFrom || "Start"} - ${groupDateTo || "End"}`
      : groupDateOptions.find((option) => option.value === groupAddedDateFilter)
          ?.label || "Added Date";

  const matchesGroupAddedDateFilter = (dateValue) => {
    if (groupAddedDateFilter === "all") {
      return true;
    }

    const createdDate = new Date(dateValue);
    if (Number.isNaN(createdDate.getTime())) {
      return false;
    }

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    if (groupAddedDateFilter === "today") {
      return createdDate >= startOfToday;
    }

    if (groupAddedDateFilter === "7d") {
      const sevenDaysAgo = new Date(startOfToday);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return createdDate >= sevenDaysAgo;
    }

    if (groupAddedDateFilter === "30d") {
      const thirtyDaysAgo = new Date(startOfToday);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return createdDate >= thirtyDaysAgo;
    }

    if (groupAddedDateFilter === "oldest") {
      return true;
    }

    if (groupAddedDateFilter === "range") {
      const fromDate = groupDateFrom ? new Date(groupDateFrom) : null;
      const toDate = groupDateTo ? new Date(groupDateTo) : null;

      if (fromDate && Number.isNaN(fromDate.getTime())) {
        return false;
      }

      if (toDate && Number.isNaN(toDate.getTime())) {
        return false;
      }

      const start = fromDate
        ? new Date(
            fromDate.getFullYear(),
            fromDate.getMonth(),
            fromDate.getDate(),
          )
        : null;
      const end = toDate
        ? new Date(
            toDate.getFullYear(),
            toDate.getMonth(),
            toDate.getDate(),
            23,
            59,
            59,
            999,
          )
        : null;

      if (start && createdDate < start) {
        return false;
      }

      if (end && createdDate > end) {
        return false;
      }

      return true;
    }

    return true;
  };

  const filteredDetailContacts = useMemo(() => {
    const filtered = groupContacts.filter(
      (contact) =>
        (contact.contact_name
          .toLowerCase()
          .includes(groupDetailSearchTerm.toLowerCase()) ||
          contact.contact_email
            .toLowerCase()
            .includes(groupDetailSearchTerm.toLowerCase())) &&
        (groupStatusFilter === "all" ||
          contact.contact_status === groupStatusFilter) &&
        matchesGroupAddedDateFilter(contact.created_at),
    );

    if (groupAddedDateFilter === "oldest") {
      return [...filtered].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at),
      );
    }

    return [...filtered].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at),
    );
  }, [
    groupContacts,
    groupStatusFilter,
    groupAddedDateFilter,
    groupDateFrom,
    groupDateTo,
    groupDetailSearchTerm,
  ]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        isGroupStatusMenuOpen &&
        groupStatusMenuRef.current &&
        !groupStatusMenuRef.current.contains(event.target)
      ) {
        setIsGroupStatusMenuOpen(false);
      }

      if (
        isGroupDateMenuOpen &&
        groupDateMenuRef.current &&
        !groupDateMenuRef.current.contains(event.target)
      ) {
        setIsGroupDateMenuOpen(false);
      }

      if (
        isQuickAddDropdownOpen &&
        quickAddDropdownRef.current &&
        !quickAddDropdownRef.current.contains(event.target)
      ) {
        setIsQuickAddDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isGroupStatusMenuOpen, isGroupDateMenuOpen, isQuickAddDropdownOpen]);

  const visibleGroups = groups.filter((group) => {
    if (!normalizedGroupSearchTerm) {
      return true;
    }

    const groupName = (group.group_name || "").toLowerCase();
    const memberSearchText =
      groupSearchMeta[group.group_id]?.searchableText || "";

    return (
      groupName.includes(normalizedGroupSearchTerm) ||
      memberSearchText.includes(normalizedGroupSearchTerm)
    );
  });

  const getAvatarTone = (seedValue) => {
    const seed = String(seedValue || "");
    const hash = seed
      .split("")
      .reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return contactAvatarTones[hash % contactAvatarTones.length];
  };

  const handleCreateClick = async () => {
    const created = await onCreateGroup(groupNameInput);
    if (created) {
      setGroupNameInput("");
      setDialogError("");
      setShowCreateDialog(false);
    } else {
      setDialogError("Please enter a valid unique group name.");
    }
  };

  const handleUpdateClick = async () => {
    const updated = await onUpdateGroup(editingGroup.group_id, groupNameInput);
    if (updated) {
      setGroupNameInput("");
      setDialogError("");
      setEditingGroup(null);
      setShowEditDialog(false);
    } else {
      setDialogError("Failed to rename group. Ensure the name is unique.");
    }
  };

  const handleViewDetails = (groupId) => {
    onSelectGroup(groupId);
    setViewMode("details");
  };

  const openEditDialog = (group) => {
    setEditingGroup(group);
    setGroupNameInput(group.group_name);
    setDialogError("");
    setShowEditDialog(true);
  };

  const handleDeleteCurrentGroup = async () => {
    const deleted = await onDeleteGroup();
    if (deleted) {
      setViewMode("list");
    }
  };

  const closeQuickAddDialog = () => {
    setShowQuickAddDialog(false);
    setQuickAddSearchQuery("");
    setQuickAddError("");
    setIsQuickAddDropdownOpen(false);
    onClearSelectedContacts?.();
  };

  const handleQuickAddContacts = async () => {
    if (selectedContactIds.length === 0) {
      setQuickAddError("Select at least one contact to add");
      return;
    }

    const assigned = await onAssignContacts();
    if (assigned) {
      closeQuickAddDialog();
    } else {
      setQuickAddError("Unable to add contacts. Please try again.");
    }
  };

  if (viewMode === "details" && selectedGroup) {
    return (
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">
              {selectedGroup.group_name}
            </h2>
            <p className="text-sm text-gray-500">
              Total contacts: {selectedGroup.contacts_count}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("list")}
              className="group flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-indigo-700 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-300 transition-all shadow-sm active:scale-95"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Back to Groups
            </button>
            {canManageContacts && (
              <>
                <button
                  onClick={() => openEditDialog(selectedGroup)}
                  className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition-all shadow-sm active:scale-95"
                >
                  <Edit2 className="h-4 w-4" />
                  Rename
                </button>
                <button
                  onClick={handleDeleteCurrentGroup}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 hover:border-red-200 transition-all shadow-sm active:scale-95"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </>
            )}
          </div>
        </header>

        {(groupError || dialogError) && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {groupError || dialogError}
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 max-w-xl">
            <div className="relative rounded-lg border border-gray-200 bg-white transition-all focus-within:border-indigo-300">
              <input
                type="text"
                placeholder="Search by name or email"
                value={groupDetailSearchTerm}
                onChange={(event) =>
                  setGroupDetailSearchTerm(event.target.value)
                }
                className="w-full rounded-lg border-none bg-transparent px-3 py-2.5 pr-10 text-sm text-gray-700 placeholder:text-gray-500 focus:outline-none"
              />
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div ref={groupStatusMenuRef} className="relative w-44">
              <button
                type="button"
                onClick={() => setIsGroupStatusMenuOpen((prev) => !prev)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left text-sm text-gray-700 focus:outline-none focus:border-indigo-300 flex items-center justify-between"
              >
                <span>{selectedGroupStatusLabel}</span>
                <ChevronDown className="h-4 w-4 text-gray-500" />
              </button>

              {isGroupStatusMenuOpen && (
                <div className="absolute z-20 mt-2 w-full rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                  {groupStatusOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setGroupStatusFilter(option.value);
                        setIsGroupStatusMenuOpen(false);
                      }}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors flex items-center justify-between ${
                        groupStatusFilter === option.value
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span>{option.label}</span>
                      {groupStatusFilter === option.value && (
                        <Check className="h-4 w-4" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div ref={groupDateMenuRef} className="relative w-56">
              <button
                type="button"
                onClick={() => setIsGroupDateMenuOpen((prev) => !prev)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left text-sm text-gray-700 focus:outline-none focus:border-indigo-300 flex items-center justify-between gap-2"
              >
                <span className="truncate">{selectedGroupDateLabel}</span>
                <div className="flex items-center gap-1">
                  {groupAddedDateFilter === "range" &&
                    (groupDateFrom || groupDateTo) && (
                      <X
                        className="h-4 w-4 text-gray-400 hover:text-gray-600"
                        onClick={(event) => {
                          event.stopPropagation();
                          setGroupDateFrom("");
                          setGroupDateTo("");
                          setGroupAddedDateFilter("all");
                        }}
                      />
                    )}
                  <Calendar className="h-4 w-4 text-gray-500" />
                </div>
              </button>

              {isGroupDateMenuOpen && (
                <div className="absolute right-0 z-20 mt-2 w-87.5 rounded-2xl border border-gray-200 bg-white p-3 shadow-xl">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={groupDateFrom}
                      onChange={(event) => {
                        setGroupDateFrom(event.target.value);
                        setGroupAddedDateFilter("range");
                      }}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-indigo-300"
                    />
                    <input
                      type="date"
                      value={groupDateTo}
                      onChange={(event) => {
                        setGroupDateTo(event.target.value);
                        setGroupAddedDateFilter("range");
                      }}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-indigo-300"
                    />
                  </div>

                  <div className="mt-3 border-t border-gray-100 pt-3 grid grid-cols-2 gap-2">
                    {groupDateOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setGroupAddedDateFilter(option.value);
                          if (option.value !== "range") {
                            setGroupDateFrom("");
                            setGroupDateTo("");
                            setIsGroupDateMenuOpen(false);
                          }
                        }}
                        className={`rounded-lg px-3 py-2 text-sm text-left transition-colors ${
                          groupAddedDateFilter === option.value
                            ? "bg-indigo-50 text-indigo-700"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {canManageContacts && (
              <button
                onClick={() => {
                  setQuickAddError("");
                  setQuickAddSearchQuery("");
                  setIsQuickAddDropdownOpen(true);
                  setShowQuickAddDialog(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-[0.98]"
              >
                <Plus className="h-4 w-4 stroke-[3px]" />
                Add to Group
              </button>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-indigo-200/60 bg-white shadow-sm shadow-indigo-100/20">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" ref={tableRef}>
              <thead className="bg-gray-100 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-600">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-600">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-600">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-600">
                    Added Date
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/70">
                {filteredDetailContacts.map((contact) => (
                  <tr
                    key={contact.contact_id}
                    className="hover:bg-gray-50/50 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold ${getAvatarTone(
                            contact.contact_email || contact.contact_name,
                          )}`}
                        >
                          {getContactInitials(
                            contact.contact_name,
                            contact.contact_email,
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {contact.contact_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {contact.contact_email}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium ${
                          contact.contact_status === "active"
                            ? "bg-green-100 text-green-700"
                            : contact.contact_status === "unsubscribed"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {contact.contact_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {new Date(contact.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <button
                        onClick={() => onEditContact(contact)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Edit Contact"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {canManageContacts && (
                        <button
                          onClick={() => onRemoveFromGroup(contact.contact_id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Remove from Group"
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      )}
                      {canManageContacts && (
                        <button
                          onClick={() => onDeleteContact(contact.contact_id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete Contact"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredDetailContacts.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-20 text-center">
                      <Users className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">
                        No contacts found for selected filters.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <Pagination tableRef={tableRef} options={[15, 30, 50]} />
          </div>
        </div>

        {/* Reuse Dialog for Renaming */}
        {showEditDialog && (
          <GroupDialog
            title="Rename Group"
            value={groupNameInput}
            onChange={setGroupNameInput}
            error={dialogError}
            onClose={() => setShowEditDialog(false)}
            onSubmit={handleUpdateClick}
          />
        )}

        {showQuickAddDialog && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-xl rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    Quick Add Contacts
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Select existing contacts to add to{" "}
                    {selectedGroup.group_name}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeQuickAddDialog}
                  className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {(quickAddError || groupError) && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {quickAddError || groupError}
                </div>
              )}

              <div className="relative" ref={quickAddDropdownRef}>
                <label className="mb-1.5 block text-xs font-medium text-gray-700">
                  Select Contacts
                </label>
                <div
                  className="min-h-11 relative rounded-lg border border-gray-200 bg-white px-2.5 py-2 pr-10 flex flex-wrap items-center gap-2 transition-all focus-within:border-indigo-300"
                  onClick={() => {
                    setIsQuickAddDropdownOpen(true);
                    document
                      .getElementById("quick-add-contact-search-input")
                      ?.focus();
                  }}
                >
                  <div className="flex items-center text-gray-400">
                    <Users className="h-4 w-4" />
                  </div>

                  {selectedContactIds.map((id) => {
                    const contact = availableContacts.find(
                      (item) => item.contact_id === id,
                    );
                    if (!contact) return null;

                    return (
                      <div
                        key={contact.contact_id}
                        className="inline-flex items-center gap-1.5 rounded-md border border-indigo-100 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700"
                      >
                        <span className="max-w-35 truncate">
                          {contact.contact_email}
                        </span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleSelectedContact(contact.contact_id);
                          }}
                          className="text-indigo-400 hover:text-indigo-700"
                        >
                          x
                        </button>
                      </div>
                    );
                  })}

                  <input
                    id="quick-add-contact-search-input"
                    type="text"
                    placeholder={
                      selectedContactIds.length === 0
                        ? "Type name or email address..."
                        : ""
                    }
                    value={quickAddSearchQuery}
                    onFocus={() => setIsQuickAddDropdownOpen(true)}
                    onChange={(event) => {
                      setQuickAddSearchQuery(event.target.value);
                      setQuickAddError("");
                      setIsQuickAddDropdownOpen(true);
                    }}
                    className="flex-1 min-w-30 h-7 bg-transparent border-none p-0 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
                  />

                  {selectedContactIds.length > 0 && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onClearSelectedContacts?.();
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                      title="Clear all selected contacts"
                    >
                      x
                    </button>
                  )}
                </div>

                {isQuickAddDropdownOpen && (
                  <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                    <div className="max-h-64 overflow-y-auto p-2">
                      {filteredAvailableContacts.length > 0 ? (
                        filteredAvailableContacts.map((contact) => {
                          const isSelected = selectedContactIds.includes(
                            contact.contact_id,
                          );
                          return (
                            <button
                              key={contact.contact_id}
                              type="button"
                              onClick={() => {
                                onToggleSelectedContact(contact.contact_id);
                                setQuickAddSearchQuery("");
                                setQuickAddError("");
                                setIsQuickAddDropdownOpen(true);
                              }}
                              className={`w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                                isSelected
                                  ? "bg-indigo-50 text-indigo-700"
                                  : "text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              <div>
                                <p className="font-medium">
                                  {contact.contact_name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {contact.contact_email}
                                </p>
                              </div>
                              {isSelected && <Check className="h-4 w-4" />}
                            </button>
                          );
                        })
                      ) : (
                        <div className="rounded-lg px-3 py-6 text-center text-sm text-gray-500">
                          No matching contacts found.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeQuickAddDialog}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleQuickAddContacts}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4" />
                  Add to Group
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // LIST VIEW (Cards)
  return (
    <div className="space-y-6">
      {(groupError || dialogError) && !showCreateDialog && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {groupError || dialogError}
        </div>
      )}

      <div className="max-w-xl">
        <div className="relative rounded-lg border border-gray-200 bg-white transition-all focus-within:border-indigo-300">
          <input
            type="text"
            placeholder="Search group by name or contact"
            value={groupListSearchTerm}
            onChange={(event) => setGroupListSearchTerm(event.target.value)}
            className="w-full rounded-lg border-none bg-transparent px-3 py-2.5 pr-10 text-sm text-gray-700 placeholder:text-gray-500 focus:outline-none"
          />
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Create Group Card */}
        {canManageContacts && (
          <button
            onClick={() => {
              setDialogError("");
              setGroupNameInput("");
              setShowCreateDialog(true);
            }}
            className="group relative flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-indigo-100 bg-white p-5 text-center shadow-sm transition-all hover:border-indigo-200 hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
              <Plus className="h-5 w-5 stroke-[2.5px]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Create Group
              </h3>
            </div>
          </button>
        )}

        {visibleGroups.map((group) => (
          <button
            key={group.group_id}
            onClick={() => handleViewDetails(group.group_id)}
            className="group relative min-h-40 cursor-pointer rounded-lg border border-indigo-100 bg-white p-4 text-center shadow-sm transition-all hover:border-indigo-200 hover:shadow-md focus:outline-none"
          >
            <div className="mt-3 flex justify-center -space-x-2">
              {(groupSearchMeta[group.group_id]?.previewContacts || []).map(
                (contact, index) => (
                  <div
                    key={`${group.group_id}-${contact.contact_email || contact.contact_name || index}-${index}`}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-semibold ${previewBadgeTones[index % previewBadgeTones.length]}`}
                    title={
                      contact.contact_email || contact.contact_name || "Contact"
                    }
                  >
                    {getContactInitials(
                      contact.contact_name,
                      contact.contact_email,
                    )}
                  </div>
                ),
              )}

              {group.contacts_count >
                (groupSearchMeta[group.group_id]?.previewContacts || [])
                  .length && (
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-xs font-semibold text-gray-600">
                  +
                  {Math.min(
                    99,
                    group.contacts_count -
                      (groupSearchMeta[group.group_id]?.previewContacts || [])
                        .length,
                  )}
                </div>
              )}
            </div>

            <div className="mt-3 flex items-start justify-center gap-2">
              <span className="line-clamp-1 text-base font-semibold text-gray-900">
                {group.group_name}
              </span>
            </div>

            <p className="mt-3 text-xs text-gray-500">
              {group.contacts_count} contact
              {group.contacts_count === 1 ? "" : "s"}
            </p>
          </button>
        ))}

        {visibleGroups.length === 0 && groups.length > 0 && (
          <div className="col-span-full rounded-xl border border-gray-200 bg-white p-10 text-center">
            <p className="text-sm text-gray-500">No matching groups found.</p>
          </div>
        )}

        {groups.length === 0 && !canManageContacts && (
          <div className="col-span-full rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-16 text-center">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-900 text-lg text-center">
              No groups available
            </h3>
            <p className="text-gray-500 max-w-xs mx-auto mt-2 font-medium">
              There are currently no segments configured. Ask an administrator
              to create one.
            </p>
          </div>
        )}
      </div>

      {showCreateDialog && (
        <GroupDialog
          title="Create New Group"
          value={groupNameInput}
          onChange={setGroupNameInput}
          error={dialogError}
          onClose={() => setShowCreateDialog(false)}
          onSubmit={handleCreateClick}
        />
      )}

      {showEditDialog && (
        <GroupDialog
          title="Rename Group"
          value={groupNameInput}
          onChange={setGroupNameInput}
          error={dialogError}
          onClose={() => setShowEditDialog(false)}
          onSubmit={handleUpdateClick}
        />
      )}
    </div>
  );
}

// Sub-component for Dialogs
function GroupDialog({ title, value, onChange, error, onClose, onSubmit }) {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">
              Group Name
            </label>
            <input
              type="text"
              autoFocus
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="e.g. VIP Customers 2024"
              className="w-full rounded-xl border border-gray-300 px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
            />
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-200 px-6 py-3.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            className="flex-1 rounded-lg bg-indigo-600 px-6 py-3.5 text-sm font-medium text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-[0.98]"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default GroupContactsTab;
