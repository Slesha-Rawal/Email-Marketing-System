import React, { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";

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
}) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [dialogError, setDialogError] = useState("");

  const handleCreateClick = async () => {
    const created = await onCreateGroup(groupNameInput);

    if (created) {
      setGroupNameInput("");
      setDialogError("");
      setShowCreateDialog(false);
      return;
    }

    setDialogError("Please enter a valid unique group name.");
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Groups</h2>
            {canManageContacts && (
              <button
                onClick={() => {
                  setDialogError("");
                  setShowCreateDialog(true);
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Create group
              </button>
            )}
          </div>

          {groupError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {groupError}
            </div>
          )}

          <div className="space-y-2">
            {groups.map((group) => (
              <button
                key={group.group_id}
                onClick={() => onSelectGroup(group.group_id)}
                className={`w-full rounded-lg border px-3 py-2 text-left ${
                  selectedGroupId === group.group_id
                    ? "border-indigo-600 bg-indigo-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <div className="font-medium text-gray-900">
                  {group.group_name}
                </div>
                <div className="text-xs text-gray-500">
                  {group.contacts_count} contact
                  {group.contacts_count === 1 ? "" : "s"}
                </div>
              </button>
            ))}

            {groups.length === 0 && (
              <div className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500">
                No groups yet. Use Create group to start organizing contacts.
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-5">
          {selectedGroup ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedGroup.group_name}
                </h2>
                {canManageContacts && (
                  <button
                    onClick={onDeleteGroup}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete group
                  </button>
                )}
              </div>

              {canManageContacts && (
                <div className="mb-5 rounded-lg border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Add contacts to this group
                  </h3>
                  <div className="max-h-40 overflow-auto space-y-2 border border-gray-200 rounded-lg p-3">
                    {availableContacts.length === 0 ? (
                      <div className="text-sm text-gray-500">
                        All contacts are already in this group
                      </div>
                    ) : (
                      availableContacts.map((contact) => {
                        const checked = selectedContactIds.includes(
                          contact.contact_id,
                        );
                        return (
                          <label
                            key={contact.contact_id}
                            className="flex items-center justify-between gap-3 text-sm text-gray-700"
                          >
                            <span>
                              {contact.contact_name} ({contact.contact_email})
                            </span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                onToggleSelectedContact(contact.contact_id)
                              }
                            />
                          </label>
                        );
                      })
                    )}
                  </div>
                  <button
                    onClick={onAssignContacts}
                    className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Add selected contacts
                  </button>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {groupContacts.map((contact) => (
                      <tr key={contact.contact_id}>
                        <td className="px-4 py-3 text-gray-900">
                          {contact.contact_name}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {contact.contact_email}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                              contact.contact_status === "active"
                                ? "bg-indigo-100 text-indigo-700"
                                : contact.contact_status === "unsubscribed"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            {contact.contact_status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {canManageContacts ? (
                            <button
                              onClick={() =>
                                onRemoveFromGroup(contact.contact_id)
                              }
                              className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                              Remove
                            </button>
                          ) : (
                            <span className="text-sm text-gray-400">
                              View only
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}

                    {groupContacts.length === 0 && (
                      <tr>
                        <td
                          colSpan="4"
                          className="px-4 py-8 text-center text-sm text-gray-500"
                        >
                          No contacts in this group yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              Create or select a group to view grouped contacts.
            </div>
          )}
        </div>
      </div>

      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Create Contact Group
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Create a group, then add selected contacts into it.
            </p>

            {(dialogError || groupError) && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {dialogError || groupError}
              </div>
            )}

            <input
              type="text"
              autoFocus
              value={groupNameInput}
              onChange={(event) => {
                setGroupNameInput(event.target.value);
                setDialogError("");
              }}
              placeholder="Enter group name"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateDialog(false);
                  setDialogError("");
                  setGroupNameInput("");
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateClick}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default GroupContactsTab;
