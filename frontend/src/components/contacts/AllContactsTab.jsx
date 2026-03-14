import React from "react";
import { Edit2, Trash2, User } from "lucide-react";

function AllContactsTab({ contacts, canManageContacts, onEdit, onDelete }) {
  return (
    <>
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                Name
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                Email
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                Status
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                Created
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {contacts.map((contact) => (
              <tr key={contact.contact_id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-gray-600" />
                    </div>
                    <span className="font-medium text-gray-900">
                      {contact.contact_name}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-600">
                  {contact.contact_email}
                </td>
                <td className="px-6 py-4">
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
                <td className="px-6 py-4 text-gray-600">
                  {new Date(contact.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  {canManageContacts ? (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => onEdit(contact)}
                        className="text-gray-400 hover:text-indigo-600"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(contact.contact_id)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">View only</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default AllContactsTab;
