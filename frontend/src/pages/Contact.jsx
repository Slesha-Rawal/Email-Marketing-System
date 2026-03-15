import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layers, Plus, Search, Users } from "lucide-react";
import Sidebar from "../components/Sidebar.jsx";
import Header from "../components/Header.jsx";
import api from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import AllContactsTab from "../components/contacts/AllContactsTab.jsx";
import GroupContactsTab from "../components/contacts/GroupContactsTab.jsx";
import EditContactModal from "../components/contacts/EditContactModal.jsx";

const initialFormState = {
  contact_name: "",
  contact_email: "",
  contact_status: "active",
};

function Contact() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManageContacts = user?.role === "marketing";

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

  const handleDeleteContact = async (id) => {
    if (!window.confirm("Delete this contact?")) {
      return;
    }

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

  const handleDeleteGroup = async () => {
    if (!selectedGroupId) {
      return;
    }

    if (!window.confirm("Delete this group?")) {
      return;
    }

    try {
      await api.delete(`/contact-groups/${selectedGroupId}`);
      setSelectedGroupId(null);
      setGroupContacts([]);
      await fetchGroups();
    } catch (error) {
      setGroupError(error.response?.data?.error || "Failed to delete group");
    }
  };

  const handleAssignContacts = async () => {
    if (!selectedGroupId) {
      setGroupError("Select a group first");
      return;
    }

    if (selectedContactIds.length === 0) {
      setGroupError("Select at least one contact to assign");
      return;
    }

    try {
      await api.post(`/contact-groups/${selectedGroupId}/contacts`, {
        contactIds: selectedContactIds,
      });

      setSelectedContactIds([]);
      await fetchGroupContacts(selectedGroupId);
      await fetchGroups();
      setGroupError("");
    } catch (error) {
      setGroupError(
        error.response?.data?.error || "Failed to add contacts to group",
      );
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

  const filteredContacts = useMemo(
    () =>
      contacts.filter(
        (contact) =>
          contact.contact_name
            .toLowerCase()
            .includes(allSearchTerm.toLowerCase()) ||
          contact.contact_email
            .toLowerCase()
            .includes(allSearchTerm.toLowerCase()),
      ),
    [contacts, allSearchTerm],
  );

  const filteredGroupContacts = useMemo(
    () =>
      groupContacts.filter(
        (contact) =>
          contact.contact_name
            .toLowerCase()
            .includes(groupSearchTerm.toLowerCase()) ||
          contact.contact_email
            .toLowerCase()
            .includes(groupSearchTerm.toLowerCase()),
      ),
    [groupContacts, groupSearchTerm],
  );

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 ml-64 flex flex-col">
        <Header />

        <div className="flex-1 overflow-auto p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
              <p className="text-sm text-gray-500 mt-1">
                {canManageContacts
                  ? "Create, group, and organize your mailing audience."
                  : "Admin access is view-only for contacts and groups."}
              </p>
            </div>
            {canManageContacts && activeTab === "all" && (
              <button
                onClick={() => navigate("/add-contact")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Add new contact
              </button>
            )}
          </div>

          <div className="mb-6 bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder={
                    activeTab === "all"
                      ? "Search contacts"
                      : "Search grouped contacts"
                  }
                  value={activeTab === "all" ? allSearchTerm : groupSearchTerm}
                  onChange={(event) => {
                    if (activeTab === "all") {
                      setAllSearchTerm(event.target.value);
                      return;
                    }
                    setGroupSearchTerm(event.target.value);
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shrink-0">
                <button
                  onClick={() => setActiveTab("all")}
                  className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium ${
                    activeTab === "all"
                      ? "bg-indigo-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <Users className="h-4 w-4" />
                  All
                </button>
                <button
                  onClick={() => setActiveTab("group")}
                  className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium ${
                    activeTab === "group"
                      ? "bg-indigo-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <Layers className="h-4 w-4" />
                  Group
                </button>
              </div>
            </div>
          </div>

          {pageError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {pageError}
            </div>
          )}

          {activeTab === "all" ? (
            <AllContactsTab
              contacts={filteredContacts}
              canManageContacts={canManageContacts}
              onEdit={openEditModal}
              onDelete={handleDeleteContact}
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
              onDeleteGroup={handleDeleteGroup}
              availableContacts={availableContacts}
              selectedContactIds={selectedContactIds}
              onToggleSelectedContact={toggleSelectedContact}
              onAssignContacts={handleAssignContacts}
              groupContacts={filteredGroupContacts}
              onRemoveFromGroup={handleRemoveFromGroup}
            />
          )}
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
    </div>
  );
}

export default Contact;
