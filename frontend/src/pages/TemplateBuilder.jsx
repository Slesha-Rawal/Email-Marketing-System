import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Monitor, Save, Smartphone } from "lucide-react";
import Header from "../components/Header.jsx";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";
import RichTextEditor from "../components/RichTextEditor.jsx";

const defaultContent = `<p>Welcome to our community!</p><p>Hello {{name}},</p><p>Thanks for joining us. We are excited to share updates and campaigns with you.</p><p>Best regards,<br/>Marketing Team</p>`;

const isRichTextEmpty = (html = "") => {
  const plainText = html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  return plainText.length === 0;
};

const TemplateBuilder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const editTemplate = location.state?.template;

  const [templateName, setTemplateName] = useState("");
  const [templateSubject, setTemplateSubject] = useState("");
  const [emailContent, setEmailContent] = useState(defaultContent);
  const [previewMode, setPreviewMode] = useState("desktop");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (editTemplate) {
      setTemplateName(editTemplate.template_name);
      setTemplateSubject(editTemplate.template_subject);
      setEmailContent(editTemplate.template_body);
    }
  }, [editTemplate]);

  const handleSave = async () => {
    if (
      !templateName.trim() ||
      !templateSubject.trim() ||
      isRichTextEmpty(emailContent)
    ) {
      setError("Template name, subject, and body are required");
      return;
    }

    setError("");
    setIsSaving(true);

    const payload = {
      template_name: templateName.trim(),
      template_subject: templateSubject.trim(),
      template_body: emailContent.trim(),
    };

    try {
      if (editTemplate?.template_id) {
        await api.put(`/templates/${editTemplate.template_id}`, payload);
      } else {
        await api.post("/templates", payload);
      }
      navigate("/templates");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Failed to save template",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 ml-64">
        <Header />

        <main className="p-8">
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate("/templates")}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">
                    {editTemplate ? "Edit Template" : "Create Template"}
                  </h1>
                  <p className="text-sm text-gray-500">
                    Minimal editor for reusable email content.
                  </p>
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-300"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save Template"}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
              <div className="space-y-5">
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(event) => setTemplateName(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Subject
                  </label>
                  <input
                    type="text"
                    value={templateSubject}
                    onChange={(event) => setTemplateSubject(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Body
                  </label>
                  <RichTextEditor
                    value={emailContent}
                    onChange={setEmailContent}
                    placeholder="Compose your email template..."
                  />
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-medium text-gray-700">
                    Live Preview
                  </h2>
                  <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
                    <button
                      onClick={() => setPreviewMode("desktop")}
                      className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${
                        previewMode === "desktop"
                          ? "bg-indigo-600 text-white"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <Monitor className="h-3.5 w-3.5" />
                      Desktop
                    </button>
                    <button
                      onClick={() => setPreviewMode("mobile")}
                      className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${
                        previewMode === "mobile"
                          ? "bg-indigo-600 text-white"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                      Mobile
                    </button>
                  </div>
                </div>

                <div
                  className={`rounded-xl border border-gray-200 bg-white overflow-hidden ${previewMode === "mobile" ? "max-w-94 mx-auto" : ""}`}
                >
                  <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      Subject
                    </p>
                    <p className="mt-1 text-sm font-medium text-gray-800">
                      {templateSubject || "Email subject"}
                    </p>
                  </div>
                  <div
                    className="tiptap min-h-124 px-5 py-5 text-sm text-gray-700 leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: isRichTextEmpty(emailContent)
                        ? "<p>Email body preview</p>"
                        : emailContent,
                    }}
                  />
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default TemplateBuilder;
