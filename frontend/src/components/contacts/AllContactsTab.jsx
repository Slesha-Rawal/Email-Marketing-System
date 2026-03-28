import React, { useRef } from "react";
import { Edit2, Trash2 } from "lucide-react";
import Pagination from "../Pagination.jsx";

function AllContactsTab({ contacts, canManageContacts, onEdit, onDelete }) {
  const tableRef = useRef(null);
  const avatarTones = [
    "bg-indigo-50 text-indigo-700",
    "bg-sky-50 text-sky-700",
    "bg-emerald-50 text-emerald-700",
    "bg-amber-50 text-amber-700",
    "bg-rose-50 text-rose-700",
  ];

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
    return localPart.slice(0, 2).toUpperCase() || "NA";
  };

  const getAvatarTone = (seedValue) => {
    const seed = String(seedValue || "");
    const hash = seed
      .split("")
      .reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return avatarTones[hash % avatarTones.length];
  };

  return (
    <>
      <div className="overflow-hidden rounded-md border border-indigo-200/60 bg-white shadow-sm shadow-indigo-100/20">
        <table className="w-full text-sm" ref={tableRef}>
          <thead className="bg-gray-100 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                Added Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100/70">
            {contacts.map((contact) => (
              <tr key={contact.contact_id} className="hover:bg-gray-50">
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
                    <span className="text-sm font-normal text-gray-900">
                      {contact.contact_name}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {contact.contact_email}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-1 text-sm font-medium ${
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
                <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                  {new Date(contact.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  {canManageContacts ? (
                    <div className="flex items-center gap-2">
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
                    <span className="text-sm text-gray-900">View only</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination
          tableRef={tableRef}
          options={[15, 30, 50]}
          footerRadiusClass="rounded-b-md"
        />
      </div>
    </>
  );
}

export default AllContactsTab;
