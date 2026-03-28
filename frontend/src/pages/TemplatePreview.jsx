import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Monitor, Smartphone } from "lucide-react";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";

function TemplatePreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [template, setTemplate] = useState(null);
  const [error, setError] = useState("");
  const [previewMode, setPreviewMode] = useState("desktop");

  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        const response = await api.get(`/templates/${id}`);
        setTemplate(response.data);
        setError("");
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Failed to load template preview",
        );
      }
    };

    fetchTemplate();
  }, [id]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 ml-64">

        <main className="p-8 space-y-6">
          <section className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Template Preview
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Read-only preview for this template.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/templates")}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Templates
            </button>
          </section>

          {error ? (
            <section className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </section>
          ) : null}

          {template ? (
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {template.template_name}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Subject: {template.template_subject}
                  </p>
                </div>

                <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
                  <button
                    type="button"
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
                    type="button"
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

              <div className="p-6">
                <div
                  className={`rounded-xl border border-gray-200 bg-white overflow-hidden mx-auto ${
                    previewMode === "mobile" ? "max-w-94" : "max-w-[600px]"
                  }`}
                >
                  <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
                    <p className="text-sm font-medium text-gray-800">
                      {template.template_subject}
                    </p>
                  </div>
                  <div
                    className="tiptap px-5 py-5 text-sm text-gray-700 leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: template.template_body || "",
                    }}
                  />
                  <div className="border-t border-gray-200 bg-gray-50 px-5 py-4 text-center">
                    <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">
                      © 2025 Kung Fu Quiz. All rights reserved.
                    </p>
                    <p className="mt-1 text-[11px] text-gray-400">
                      Don't want to receive these emails?{" "}
                      <a
                        href="/unsubscribe"
                        className="text-indigo-600 underline font-medium"
                      >
                        Unsubscribe here
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}

export default TemplatePreview;
