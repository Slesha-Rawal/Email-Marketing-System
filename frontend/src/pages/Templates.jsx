import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Edit2, Plus, Search, Trash2 } from "lucide-react";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Pagination from "../components/Pagination.jsx";
import { isUsers } from "../lib/rbac.js";

const Templates = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tableRef = useRef(null);
  const canManageTemplates = isUsers(user);
  const [searchQuery, setSearchQuery] = useState("");
  const [templates, setTemplates] = useState([]);
  const [pageError, setPageError] = useState("");
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    template: null,
    loading: false,
  });

  const fetchTemplates = async () => {
    try {
      const response = await api.get("/templates");
      setTemplates(response.data);
      setPageError("");
    } catch (error) {
      setPageError(error.response?.data?.message || "Failed to load templates");
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleCreateNew = () => {
    navigate("/template-builder");
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/templates/${id}`);
      await fetchTemplates();
      return true;
    } catch (error) {
      setPageError(
        error.response?.data?.message || "Failed to delete template",
      );
      return false;
    }
  };

  const openDeleteModal = (template) => {
    setPageError("");
    setDeleteModal({ isOpen: true, template, loading: false });
  };

  const closeDeleteModal = () => {
    if (deleteModal.loading) {
      return;
    }

    setDeleteModal({ isOpen: false, template: null, loading: false });
  };

  const confirmDeleteTemplate = async () => {
    if (!deleteModal.template?.template_id) {
      return;
    }

    setDeleteModal((prev) => ({ ...prev, loading: true }));
    const isSuccess = await handleDelete(deleteModal.template.template_id);

    if (isSuccess) {
      setDeleteModal({ isOpen: false, template: null, loading: false });
      return;
    }

    setDeleteModal((prev) => ({ ...prev, loading: false }));
  };

  const filteredTemplates = templates.filter((template) =>
    template.template_name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const formatTemplateTimestamp = (value) => {
    if (!value) {
      return "-";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "-";
    }

    return parsed.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 ml-64 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Templates</h1>
              <p className="text-sm text-gray-500 mt-1">
                {canManageTemplates
                  ? "Create and manage reusable email content."
                  : "View templates only."}
              </p>
            </div>
            {canManageTemplates && (
              <button
                onClick={() => navigate("/template-builder")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Create Template
              </button>
            )}
          </div>

          <div className="mb-6 p-0">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative rounded-md border border-gray-200 bg-white transition-all focus-within:border-indigo-300">
                <Search
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Search templates by name"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-md border-none bg-transparent pl-3 pr-10 py-2 text-sm text-gray-700 placeholder:text-gray-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="p-0">
            {filteredTemplates.length === 0 && templates.length === 0 ? (
              <div className="text-center py-12">
                <h3 className="text-lg font-semibold text-gray-600 mb-2">
                  No templates found
                </h3>
                <p className="text-gray-500 mb-6">
                  {searchQuery
                    ? "Try adjusting your search"
                    : "Get started by creating your first email template"}
                </p>
                {!searchQuery && canManageTemplates && (
                  <button
                    onClick={handleCreateNew}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Create Template
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border border-indigo-200/60 bg-white">
                <table className="w-full text-sm" ref={tableRef}>
                  <thead className="bg-gray-100 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                        Last Updated By
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                        Last Updated Date
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100/70">
                    {filteredTemplates.map((template) => (
                      <tr
                        key={template.template_id}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {template.template_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {template.created_by_name || "Unknown"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                          {formatTemplateTimestamp(template.updated_at)}
                        </td>
                        <td className="px-4 py-3">
                          {canManageTemplates ? (
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() =>
                                  navigate(
                                    `/template-builder/${template.template_id}`,
                                  )
                                }
                                className="text-gray-400 hover:text-indigo-600"
                                title="Edit"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openDeleteModal(template)}
                                className="text-gray-400 hover:text-red-600"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-900">
                              View only
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredTemplates.length === 0 && (
                      <tr>
                        <td
                          colSpan="4"
                          className="px-6 py-12 text-center text-sm text-gray-500"
                        >
                          No templates found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <Pagination
                  tableRef={tableRef}
                  options={[15, 30, 50]}
                  footerRadiusClass="rounded-b-md"
                />
              </div>
            )}
          </div>
        </main>
      </div>

      {deleteModal.isOpen && deleteModal.template && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="text-base font-semibold text-gray-900">
                Delete Template
              </h3>
            </div>

            <div className="px-5 py-4">
              <p className="text-sm text-gray-600">
                Are you sure you want to delete "
                {deleteModal.template.template_name}"? This cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 pb-4">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleteModal.loading}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteTemplate}
                disabled={deleteModal.loading}
                className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {deleteModal.loading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Templates;
