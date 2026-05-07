import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import AllContactsTab from "../components/contacts/AllContactsTab.jsx";
import GroupContactsTab from "../components/contacts/GroupContactsTab.jsx";
import EditContactModal from "../components/contacts/EditContactModal.jsx";
import DateRangeFilter from "../components/contacts/DateRangeFilter.jsx";
import { isUsers } from "../lib/rbac.js";

const initialFormState = {
  contact_name: "",
  contact_email: "",
  contact_status: "active",
};

const initialConfirmState = {
  isOpen: false,
  action: null,
  contactId: null,
  contactName: "",
  contactEmail: "",
};

function Contact() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManageContacts = isUsers(user);

  const [activeTab, setActiveTab] = useState("all");
  const [allSearchTerm, setAllSearchTerm] = useState("");
  const [groupSearchTerm, setGroupSearchTerm] = useState("");

  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [groupContacts, setGroupContacts] = useState([]);

  const [selectedContactIds, setSelectedContactIds] = useState([]);

  const [showEditModal, setShowEditModal] = useState(false);
  const [currentContact, setCurrentContact] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const [confirmState, setConfirmState] = useState(initialConfirmState);
  const [isConfirmSubmitting, setIsConfirmSubmitting] = useState(false);
  const [groupDeleteVersion, setGroupDeleteVersion] = useState(0);

  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [groupError, setGroupError] = useState("");

  const fetchContacts = async () => {
    try {
      const response = await api.get("/contacts");
      setContacts(response.data);
      setPageError("");
    } catch (error) {
      setPageError(error.response?.data?.error || "Failed to load contacts");
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await api.get("/contact-groups");
      const nextGroups = response.data;
      setGroups(nextGroups);

      if (!selectedGroupId && nextGroups.length > 0) {
        setSelectedGroupId(nextGroups[0].group_id);
      }

      if (
        selectedGroupId &&
        !nextGroups.some((group) => group.group_id === selectedGroupId)
      ) {
        setSelectedGroupId(
          nextGroups.length > 0 ? nextGroups[0].group_id : null,
        );
      }

      setGroupError("");
    } catch (error) {
      setGroupError(error.response?.data?.error || "Failed to load groups");
    }
  };

  const fetchGroupContacts = async (groupId) => {
    if (!groupId) {
      setGroupContacts([]);
      return;
    }

    try {
      const response = await api.get(`/contact-groups/${groupId}/contacts`);
      setGroupContacts(response.data);
      setGroupError("");
    } catch (error) {
      setGroupContacts([]);
      setGroupError(
        error.response?.data?.error || "Failed to load grouped contacts",
      );
    }
  };

  useEffect(() => {
    fetchContacts();
    fetchGroups();
  }, []);

  useEffect(() => {
    fetchGroupContacts(selectedGroupId);
    setSelectedContactIds([]);
  }, [selectedGroupId]);

  const openEditModal = (contact) => {
    setCurrentContact(contact);
    setFormData({
      contact_name: contact.contact_name,
      contact_email: contact.contact_email,
      contact_status: contact.contact_status,
    });
    setFormError("");
    setShowEditModal(true);
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleUpdateContact = async (event) => {
    event.preventDefault();

    try {
      await api.put(`/contacts/${currentContact.contact_id}`, formData);
      setShowEditModal(false);
      setCurrentContact(null);
      setFormData(initialFormState);
      fetchContacts();
      if (selectedGroupId) {
        fetchGroupContacts(selectedGroupId);
      }
    } catch (error) {
      setFormError(error.response?.data?.error || "Failed to update contact");
    }
  };

  const requestDeleteContact = (id) => {
    const contact =
      contacts.find((item) => item.contact_id === id) ||
      groupContacts.find((item) => item.contact_id === id);

    setConfirmState({
      isOpen: true,
      action: "delete",
      contactId: id,
      contactName: contact?.contact_name || "this contact",
      contactEmail: contact?.contact_email || "",
    });
  };

  const handleDeleteContact = async (id) => {
    try {
      await api.delete(`/contacts/${id}`);
      fetchContacts();
      if (selectedGroupId) {
        fetchGroupContacts(selectedGroupId);
      }
    } catch (error) {
      setPageError(error.response?.data?.error || "Failed to delete contact");
    }
  };

  const handleCreateGroup = async (groupNameInput) => {
    const groupName = groupNameInput?.trim();

    if (!groupName) {
      setGroupError("Group name is required");
      return false;
    }

    try {
      const response = await api.post("/contact-groups", {
        group_name: groupName,
      });
      setSelectedGroupId(response.data.group_id);
      await fetchGroups();
      await fetchGroupContacts(response.data.group_id);
      setGroupError("");
      return true;
    } catch (error) {
      setGroupError(error.response?.data?.error || "Failed to create group");
      return false;
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!groupId) {
      return false;
    }

    try {
      await api.delete(`/contact-groups/${groupId}`);
      setSelectedGroupId(null);
      setGroupContacts([]);
      await fetchGroups();
      return true;
    } catch (error) {
      setGroupError(error.response?.data?.error || "Failed to delete group");
      return false;
    }
  };

  const requestDeleteGroup = () => {
    if (!selectedGroupId || !selectedGroup) {
      return false;
    }

    setConfirmState({
      isOpen: true,
      action: "delete-group",
      contactId: selectedGroupId,
      contactName: selectedGroup.group_name || "this group",
      contactEmail: "",
    });

    return true;
  };

  const handleUpdateGroup = async (groupId, newName) => {
    try {
      await api.put(`/contact-groups/${groupId}`, { group_name: newName });
      await fetchGroups();
      setGroupError("");
      return true;
    } catch (error) {
      setGroupError(error.response?.data?.error || "Failed to rename group");
      return false;
    }
  };

  const handleAssignContacts = async () => {
    if (!selectedGroupId) {
      setGroupError("Select a group first");
      return false;
    }

    if (selectedContactIds.length === 0) {
      setGroupError("Select at least one contact to assign");
      return false;
    }

    try {
      await api.post(`/contact-groups/${selectedGroupId}/contacts`, {
        contactIds: selectedContactIds,
      });

      setSelectedContactIds([]);
      await fetchGroupContacts(selectedGroupId);
      await fetchGroups();
      setGroupError("");
      return true;
    } catch (error) {
      setGroupError(
        error.response?.data?.error || "Failed to add contacts to group",
      );
      return false;
    }
  };

  const handleRemoveFromGroup = async (contactId) => {
    if (!selectedGroupId) {
      return;
    }

    try {
      await api.delete(
        `/contact-groups/${selectedGroupId}/contacts/${contactId}`,
      );
      await fetchGroupContacts(selectedGroupId);
      await fetchGroups();
    } catch (error) {
      setGroupError(
        error.response?.data?.error || "Failed to remove contact from group",
      );
    }
  };

  const requestRemoveFromGroup = (contactId) => {
    const contact = groupContacts.find((item) => item.contact_id === contactId);

    setConfirmState({
      isOpen: true,
      action: "remove-from-group",
      contactId,
      contactName: contact?.contact_name || "this contact",
      contactEmail: contact?.contact_email || "",
    });
  };

  const closeConfirmModal = () => {
    if (isConfirmSubmitting) {
      return;
    }

    setConfirmState(initialConfirmState);
  };

  const handleConfirmAction = async () => {
    if (!confirmState.contactId || !confirmState.action) {
      return;
    }

    try {
      setIsConfirmSubmitting(true);

      if (confirmState.action === "delete") {
        await handleDeleteContact(confirmState.contactId);
      }

      if (confirmState.action === "remove-from-group") {
        await handleRemoveFromGroup(confirmState.contactId);
      }

      if (confirmState.action === "delete-group") {
        const deleted = await handleDeleteGroup(confirmState.contactId);
        if (deleted) {
          setGroupDeleteVersion((prev) => prev + 1);
        }
      }

      setConfirmState(initialConfirmState);
    } finally {
      setIsConfirmSubmitting(false);
    }
  };

  const toggleSelectedContact = (contactId) => {
    setSelectedContactIds((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId],
    );
  };

  const selectedGroup = useMemo(
    () => groups.find((group) => group.group_id === selectedGroupId) || null,
    [groups, selectedGroupId],
  );

  const groupedIds = useMemo(
    () => new Set(groupContacts.map((contact) => contact.contact_id)),
    [groupContacts],
  );

  const availableContacts = useMemo(
    () => contacts.filter((contact) => !groupedIds.has(contact.contact_id)),
    [contacts, groupedIds],
  );

  const [statusFilter, setStatusFilter] = useState("all");
  const [addedDateFilter, setAddedDateFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
  const allTabRef = useRef(null);
  const groupTabRef = useRef(null);
  const statusMenuRef = useRef(null);
  const dateMenuRef = useRef(null);
  const [tabIndicatorStyle, setTabIndicatorStyle] = useState({
    width: "0px",
    left: "0px",
  });

  const statusOptions = [
    { value: "all", label: "Select Status" },
    { value: "active", label: "Active" },
    { value: "unsubscribed", label: "Unsubscribed" },
    { value: "bounced", label: "Bounced" },
  ];

  const selectedStatusLabel =
    statusOptions.find((option) => option.value === statusFilter)?.label ||
    "Select Status";

  const selectedDateLabel =
    addedDateFilter === "range" && (dateFrom || dateTo)
      ? `${dateFrom || "Start"} - ${dateTo || "End"}`
      : "Added Date";

  const matchesAddedDateFilter = (dateValue) => {
    if (addedDateFilter === "all") {
      return true;
    }

    const createdDate = new Date(dateValue);
    if (Number.isNaN(createdDate.getTime())) {
      return false;
    }

    if (addedDateFilter === "range") {
      const fromDate = dateFrom ? new Date(dateFrom) : null;
      const toDate = dateTo ? new Date(dateTo) : null;

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

  const sortByAddedDate = (list) => {
    return [...list].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at),
    );
  };

  const filteredContacts = useMemo(() => {
    const filtered = contacts.filter(
      (contact) =>
        (statusFilter === "all" || contact.contact_status === statusFilter) &&
        matchesAddedDateFilter(contact.created_at) &&
        (contact.contact_name
          .toLowerCase()
          .includes(allSearchTerm.toLowerCase()) ||
          contact.contact_email
            .toLowerCase()
            .includes(allSearchTerm.toLowerCase())),
    );

    return sortByAddedDate(filtered);
  }, [
    contacts,
    allSearchTerm,
    statusFilter,
    addedDateFilter,
    dateFrom,
    dateTo,
  ]);

  const filteredGroupContacts = useMemo(() => {
    const filtered = groupContacts.filter(
      (contact) =>
        contact.contact_name
          .toLowerCase()
          .includes(groupSearchTerm.toLowerCase()) ||
        contact.contact_email
          .toLowerCase()
          .includes(groupSearchTerm.toLowerCase()),
    );

    return [...filtered].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at),
    );
  }, [groupContacts, groupSearchTerm]);

  useEffect(() => {
    const updateIndicator = () => {
      const target =
        activeTab === "all" ? allTabRef.current : groupTabRef.current;
      if (!target) {
        return;
      }

      setTabIndicatorStyle({
        width: `${target.offsetWidth}px`,
        left: `${target.offsetLeft}px`,
      });
    };

    updateIndicator();
    window.addEventListener("resize", updateIndicator);

    return () => window.removeEventListener("resize", updateIndicator);
  }, [activeTab]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        isStatusMenuOpen &&
        statusMenuRef.current &&
        !statusMenuRef.current.contains(event.target)
      ) {
        setIsStatusMenuOpen(false);
      }

      if (
        isDateMenuOpen &&
        dateMenuRef.current &&
        !dateMenuRef.current.contains(event.target)
      ) {
        setIsDateMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isStatusMenuOpen, isDateMenuOpen]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 ml-64 flex flex-col">
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header Section */}
            <header className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
              <p className="mt-1 text-sm text-gray-500">
                {canManageContacts
                  ? "Manage your audience, organize contacts in groups, and monitor subscriber status."
                  : "View contacts and segments."}
              </p>
            </header>

            {/* Modern Tab Switcher */}
            <div className="relative border-b border-gray-200 mb-8">
              <nav className="flex gap-10">
                <button
                  ref={allTabRef}
                  onClick={() => setActiveTab("all")}
                  className={`pb-4 text-sm font-medium transition-all relative ${
                    activeTab === "all"
                      ? "text-indigo-600"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  All Contacts
                </button>
                <button
                  ref={groupTabRef}
                  onClick={() => setActiveTab("group")}
                  className={`pb-4 text-sm font-medium transition-all relative ${
                    activeTab === "group"
                      ? "text-indigo-600"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  Groups
                </button>
              </nav>
              {/* Smooth Animated Underline */}
              <div
                className="absolute bottom-0 h-0.5 bg-indigo-600 transition-all duration-300 ease-in-out"
                style={tabIndicatorStyle}
              />
            </div>

            {/* Search Row (with Filter and Add Button) */}
            {activeTab === "all" && (
              <div className="mb-8 flex flex-nowrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1 max-w-xl">
                  <div className="relative rounded-lg border border-gray-200 bg-white transition-all focus-within:border-indigo-300">
                    <input
                      type="text"
                      placeholder="Search by name or email"
                      value={allSearchTerm}
                      onChange={(event) => setAllSearchTerm(event.target.value)}
                      className="w-full rounded-lg border-none bg-transparent px-3 py-2.5 pr-10 text-sm text-gray-700 placeholder:text-gray-500 focus:outline-none"
                    />
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <div ref={statusMenuRef} className="relative w-44">
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
                            key={option.value}
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

                  <DateRangeFilter
                    menuRef={dateMenuRef}
                    isOpen={isDateMenuOpen}
                    onToggle={() => setIsDateMenuOpen((prev) => !prev)}
                    selectedLabel={selectedDateLabel}
                    isRangeActive={
                      addedDateFilter === "range" && (dateFrom || dateTo)
                    }
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    onDateRangeChange={({ from, to }) => {
                      setDateFrom(from);
                      setDateTo(to);
                      setAddedDateFilter("range");
                    }}
                    onClear={() => {
                      setDateFrom("");
                      setDateTo("");
                      setAddedDateFilter("all");
                    }}
                  />

                  {canManageContacts && (
                    <button
                      onClick={() => navigate("/add-contact")}
                      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-[0.98]"
                    >
                      <Plus className="h-4 w-4 stroke-[3px]" />
                      Add new contact
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeTab === "all" ? (
              <AllContactsTab
                contacts={filteredContacts}
                canManageContacts={canManageContacts}
                onEdit={openEditModal}
                onDelete={requestDeleteContact}
              />
            ) : (
              <GroupContactsTab
                canManageContacts={canManageContacts}
                groups={groups}
                selectedGroupId={selectedGroupId}
                onSelectGroup={setSelectedGroupId}
                selectedGroup={selectedGroup}
                groupError={groupError}
                onCreateGroup={handleCreateGroup}
                onDeleteGroup={requestDeleteGroup}
                availableContacts={availableContacts}
                selectedContactIds={selectedContactIds}
                onToggleSelectedContact={toggleSelectedContact}
                onAssignContacts={handleAssignContacts}
                groupContacts={filteredGroupContacts}
                onRemoveFromGroup={requestRemoveFromGroup}
                onUpdateGroup={handleUpdateGroup}
                onEditContact={openEditModal}
                onDeleteContact={requestDeleteContact}
                onClearSelectedContacts={() => setSelectedContactIds([])}
                groupDeleteVersion={groupDeleteVersion}
              />
            )}
          </div>
        </div>
      </div>

      <EditContactModal
        show={showEditModal}
        formData={formData}
        formError={formError}
        onChange={handleFormChange}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleUpdateContact}
      />

      <ConfirmActionModal
        show={confirmState.isOpen}
        title={
          confirmState.action === "delete-group"
            ? "Delete group?"
            : confirmState.action === "remove-from-group"
              ? "Remove contact from group?"
              : "Delete contact?"
        }
        description={
          confirmState.action === "delete-group"
            ? `${confirmState.contactName} and all its member assignments will be removed.`
            : confirmState.action === "remove-from-group"
              ? `${confirmState.contactName} will be removed from ${selectedGroup?.group_name || "this group"}.`
              : `${confirmState.contactName} will be permanently deleted from contacts and all groups.`
        }
        detail={confirmState.contactEmail}
        confirmLabel={
          confirmState.action === "delete-group"
            ? "Delete Group"
            : confirmState.action === "remove-from-group"
              ? "Remove Contact"
              : "Delete Contact"
        }
        isLoading={isConfirmSubmitting}
        onCancel={closeConfirmModal}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}

function ConfirmActionModal({
  show,
  title,
  description,
  detail,
  confirmLabel,
  isLoading,
  onCancel,
  onConfirm,
}) {
  if (!show) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        </div>

        <div className="px-5 py-4">
          <p className="text-sm text-gray-600">{description}</p>
          {detail && <p className="mt-2 text-xs text-gray-500">{detail}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 pb-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {isLoading ? "Please wait..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Contact;
