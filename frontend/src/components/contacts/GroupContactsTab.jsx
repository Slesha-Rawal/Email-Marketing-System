import React, { useState, useRef } from "react";
import {
  ArrowLeft,
  Edit2,
  Eye,
  LayoutGrid,
  MoreVertical,
  Plus,
  Trash2,
  User,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import Pagination from "../Pagination.jsx";

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
}) {
  const tableRef = useRef(null);
  const [viewMode, setViewMode] = useState("list"); // list or details
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [editingGroup, setEditingGroup] = useState(null);
  const [dialogError, setDialogError] = useState("");

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

  if (viewMode === "details" && selectedGroup) {
    return (
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">
              {selectedGroup.group_name}
            </h2>
            <p className="text-sm text-gray-500">
              Segment overview •{" "}
              <span className="text-indigo-600 font-medium">
                {selectedGroup.contacts_count}
              </span>{" "}
              subscribers
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("list")}
              className="group flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 hover:border-indigo-200 hover:text-indigo-600 transition-all shadow-sm active:scale-95"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Back to Groups
            </button>
            {canManageContacts && (
              <>
                <button
                  onClick={() => openEditDialog(selectedGroup)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-indigo-200 hover:text-indigo-600 transition-all shadow-sm active:scale-95"
                >
                  <Edit2 className="h-4 w-4" />
                  Rename
                </button>
                <button
                  onClick={onDeleteGroup}
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Add Contacts Sidebar */}
          {canManageContacts && (
            <div className="lg:col-span-1 h-fit sticky top-8">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Plus className="h-4 w-4 text-indigo-500" />
                Quick Add
              </h3>
              <div className="space-y-4">
                <div className="max-h-60 overflow-y-auto space-y-2 border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                  {availableContacts.length > 0 ? (
                    availableContacts.map((contact) => (
                      <label
                        key={contact.contact_id}
                        className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors border border-transparent hover:border-gray-200"
                      >
                        <input
                          type="checkbox"
                          checked={selectedContactIds.includes(
                            contact.contact_id,
                          )}
                          onChange={() =>
                            onToggleSelectedContact(contact.contact_id)
                          }
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">
                            {contact.contact_name}
                          </p>
                          <p className="text-[10px] text-gray-400 truncate">
                            {contact.contact_email}
                          </p>
                        </div>
                      </label>
                    ))
                  ) : (
                    <p className="text-xs text-center py-4 text-gray-500">
                      All contacts already added!
                    </p>
                  )}
                </div>
                <button
                  onClick={onAssignContacts}
                  disabled={selectedContactIds.length === 0}
                  className="w-full bg-indigo-600 text-white rounded-lg px-4 py-2.5 text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-100"
                >
                  Add Selected ({selectedContactIds.length})
                </button>
              </div>
            </div>
          )}

          {/* Group Contacts Table */}
          <div
            className={`bg-white overflow-hidden ${canManageContacts ? "lg:col-span-3" : "lg:col-span-4"}`}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left" ref={tableRef}>
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Name
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Email
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Added Date
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {groupContacts.map((contact) => (
                    <tr
                      key={contact.contact_id}
                      className="hover:bg-gray-50/50 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-indigo-600" />
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {contact.contact_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {contact.contact_email}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
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
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(contact.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right space-x-1">
                        <button
                          onClick={() => onEditContact(contact)}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="Edit Contact"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {canManageContacts && (
                          <button
                            onClick={() =>
                              onRemoveFromGroup(contact.contact_id)
                            }
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Remove from Group"
                          >
                            <UserMinus className="h-4 w-4" />
                          </button>
                        )}
                        {canManageContacts && (
                          <button
                            onClick={() => onDeleteContact(contact.contact_id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete Contact"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {groupContacts.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-6 py-20 text-center">
                        <Users className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">
                          No contacts in this group yet.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <Pagination tableRef={tableRef} options={[15, 30, 50]} />
            </div>
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
      </div>
    );
  }

  // LIST VIEW (Cards)
  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest mb-1">
            Segmentation
          </p>
          <h2 className="text-3xl font-bold text-white">Mailing Groups</h2>
          <p className="text-sm text-gray-400 mt-1">
            Organize your contacts into segments for targeted campaigns.
          </p>
        </div>
      </header>

      {(groupError || dialogError) && !showCreateDialog && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {groupError || dialogError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {/* Create Group Card */}
        {canManageContacts && (
          <button
            onClick={() => {
              setDialogError("");
              setGroupNameInput("");
              setShowCreateDialog(true);
            }}
            className="group relative flex flex-col items-center justify-center gap-4 rounded-xl bg-[#272739] border border-[#232336] p-8 text-center hover:border-indigo-500 hover:bg-[#232336] hover:shadow-xl hover:shadow-indigo-900/10 transition-all min-h-65"
          >
            <div className="w-16 h-16 rounded-full bg-indigo-700 flex items-center justify-center text-white group-hover:bg-indigo-500 transition-all shadow-md">
              <Plus className="h-8 w-8 stroke-[3px]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white mt-3">
                Create Group
              </h3>
            </div>
          </button>
        )}

        {groups.map((group) => (
          <button
            key={group.group_id}
            onClick={() => handleViewDetails(group.group_id)}
            className="group bg-[#272739] rounded-xl border border-[#232336] p-8 flex flex-col items-center min-h-65 transition-all hover:border-indigo-500 hover:bg-[#232336] hover:shadow-xl hover:shadow-indigo-900/10 relative cursor-pointer focus:outline-none"
          >
            {/* Group Avatar */}
            <div className="w-16 h-16 rounded-full bg-indigo-800 flex items-center justify-center mb-4 mt-2 shadow-md">
              <Users className="h-8 w-8 text-white" />
            </div>
            {/* Group Name */}
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-white mb-1 line-clamp-1">
                {group.group_name}
              </span>
              <span className="text-sm text-gray-400 font-medium">
                {group.contacts_count}{" "}
                <span className="text-gray-500 font-normal">Members</span>
              </span>
            </div>
          </button>
        ))}

        {groups.length === 0 && !canManageContacts && (
          <div className="col-span-full rounded-xl border-2 border-dashed border-gray-200 p-16 text-center bg-gray-50/50">
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
