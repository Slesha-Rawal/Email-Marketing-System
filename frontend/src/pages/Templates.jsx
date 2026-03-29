import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Edit2, Eye, Mail, Plus, Search, Trash2 } from "lucide-react";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const Templates = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManageTemplates = user?.role === "marketing";
  const [searchQuery, setSearchQuery] = useState("");
  const [templates, setTemplates] = useState([]);
  const [pageError, setPageError] = useState("");

  const stripHtml = (value = "") =>
    value
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .trim();

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
    if (!window.confirm("Delete this template?")) {
      return;
    }

    try {
      await api.delete(`/templates/${id}`);
      fetchTemplates();
    } catch (error) {
      setPageError(
        error.response?.data?.message || "Failed to delete template",
      );
    }
  };

  const filteredTemplates = templates.filter(
    (template) =>
      template.template_name
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      template.template_subject
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      stripHtml(template.template_body)
        .toLowerCase()
        .includes(searchQuery.toLowerCase()),
  );

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
                  : "Admin access is view-only for templates."}
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

          {pageError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {pageError}
            </div>
          )}

          <div className="mb-6 p-0">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative rounded-lg border border-gray-200 bg-white transition-all focus-within:border-indigo-300">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="text"
                  placeholder="Search Templates by name"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border-none bg-transparent pl-10 pr-4 py-2.5 text-sm text-gray-700 placeholder:text-gray-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="p-0">
            {filteredTemplates.length === 0 ? (
              <div className="text-center py-12">
                <Mail size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">
                  No templates found
                </h3>
                <p className="text-gray-500 mb-6">
                  {searchQuery
                    ? "Try adjusting your search"
                    : "Get started by creating your first email template"}
                </p>
                {!searchQuery && (
                  <button
                    onClick={handleCreateNew}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Plus size={20} />
                    Create Template
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTemplates.map((template) => (
                  <div
                    key={template.template_id}
                    className="border border-indigo-100/70 rounded-lg p-5 bg-indigo-50/35 hover:shadow-sm transition-all hover:border-gray-300 hover:bg-indigo-50/55"
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg">
                        <Mail size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-base mb-1 text-gray-800 truncate">
                          {template.template_name}
                        </h4>
                        <p className="text-sm text-indigo-600 font-medium mb-2 truncate">
                          {template.template_subject}
                        </p>
                        <p className="text-gray-600 text-sm line-clamp-3">
                          {stripHtml(template.template_body)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div className="text-xs text-gray-500">
                        <div>
                          Last Updated By:{" "}
                          {template.created_by_name || "Unknown"}
                        </div>
                        <div>
                          Last Updated Date:{" "}
                          {new Date(template.updated_at).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            navigate(
                              `/templates/${template.template_id}/preview`,
                            )
                          }
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors group"
                          title="Preview"
                        >
                          <Eye
                            size={18}
                            className="text-gray-600 group-hover:text-indigo-600"
                          />
                        </button>
                        {canManageTemplates ? (
                          <>
                            <button
                              onClick={() =>
                                navigate("/template-builder", {
                                  state: { template },
                                })
                              }
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors group"
                              title="Edit"
                            >
                              <Edit2
                                size={18}
                                className="text-gray-600 group-hover:text-indigo-600"
                              />
                            </button>
                            <button
                              onClick={() => handleDelete(template.template_id)}
                              className="p-2 hover:bg-red-50 rounded-lg transition-colors group"
                              title="Delete"
                            >
                              <Trash2
                                size={18}
                                className="text-gray-600 group-hover:text-red-600"
                              />
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400 px-2">
                            View only
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Templates;
