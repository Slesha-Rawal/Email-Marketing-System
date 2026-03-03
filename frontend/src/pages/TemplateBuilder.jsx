import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Mail,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link,
  Image,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Monitor,
  Smartphone,
  Save,
  ArrowLeft,
} from "lucide-react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";

const TemplateBuilder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const editTemplate = location.state?.template;

  const [templateName, setTemplateName] = useState("");
  const [templateSubject, setTemplateSubject] = useState("");
  const [emailContent, setEmailContent] = useState("");
  const [previewMode, setPreviewMode] = useState("desktop");

  const defaultContent = `Welcome to Our Community! 🎉

Dear [Name],

Thank you for joining our growing community at Kung Fu Quiz! We're thrilled to have you on board.

To help you get started, here are a few useful links:
• Sifu Guide
• Help page

We're constantly working to improve your experience. Feel free to reach out if you have any questions.

Best regards,
The Kung Fu Quiz Team`;

  useEffect(() => {
    if (editTemplate) {
      setTemplateName(editTemplate.title);
      setTemplateSubject(editTemplate.subject);
      setEmailContent(editTemplate.content);
    } else {
      setEmailContent(defaultContent);
    }
  }, [editTemplate]);

  const handleSave = () => {
    if (!templateName || !templateSubject || !emailContent) {
      alert("Please fill in all fields");
      return;
    }

    // Here you would typically make an API call to save the template
    const templateData = {
      title: templateName,
      subject: templateSubject,
      content: emailContent,
      updatedAt: new Date().toISOString(),
    };

    console.log("Saving template:", templateData);
    alert("Template saved successfully!");
    navigate("/templates");
  };

  const toolbarButtons = [
    { icon: Bold, title: "Bold" },
    { icon: Italic, title: "Italic" },
    { icon: Underline, title: "Underline" },
    { divider: true },
    { icon: List, title: "Bullet List" },
    { icon: ListOrdered, title: "Numbered List" },
    { divider: true },
    { icon: Link, title: "Insert Link" },
    { icon: Image, title: "Insert Image" },
    { divider: true },
    { icon: AlignLeft, title: "Align Left" },
    { icon: AlignCenter, title: "Align Center" },
    { icon: AlignRight, title: "Align Right" },
    { icon: AlignJustify, title: "Justify" },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-8">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200">
            {/* Header Section */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-white">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate("/templates")}
                  className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all duration-200"
                  title="Back to templates"
                >
                  <ArrowLeft size={24} className="text-gray-600" />
                </button>
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white p-3 rounded-xl shadow-md">
                  <Mail size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    {editTemplate ? "Edit Template" : "Create New Template"}
                  </h2>
                  <p className="text-gray-600 text-sm mt-1">
                    Design your email template with live preview
                  </p>
                </div>
              </div>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 hover:shadow-lg transition-all duration-200 font-medium"
              >
                <Save size={20} />
                Save Template
              </button>
            </div>

            {/* Main Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8">
              {/* Editor Section */}
              <div className="space-y-6">
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <span>Template Name</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Welcome Email, Newsletter Template"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-gray-400"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <span>Email Subject</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Welcome to our community!"
                    value={templateSubject}
                    onChange={(e) => setTemplateSubject(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-gray-400"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <span>Email Content</span>
                    <span className="text-red-500">*</span>
                  </label>

                  {/* Toolbar */}
                  <div className="flex items-center gap-1 p-3 bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-gray-300 rounded-t-lg flex-wrap shadow-sm">
                    {toolbarButtons.map((button, index) =>
                      button.divider ? (
                        <div
                          key={`divider-${index}`}
                          className="w-px h-6 bg-gray-400 mx-1"
                        ></div>
                      ) : (
                        <button
                          key={index}
                          className="p-2 hover:bg-white hover:shadow-md rounded-md transition-all duration-200 text-gray-700 hover:text-indigo-600 active:scale-95"
                          title={button.title}
                          type="button"
                        >
                          <button.icon size={18} />
                        </button>
                      ),
                    )}
                  </div>

                  {/* Content Editor */}
                  <textarea
                    value={emailContent}
                    onChange={(e) => setEmailContent(e.target.value)}
                    className="w-full px-4 py-4 border-2 border-gray-300 border-t-0 rounded-b-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[500px] font-sans resize-none transition-all duration-200 leading-relaxed hover:border-gray-400"
                    placeholder="Start typing your email content... Use [Name] for personalization."
                  />
                  <div className="flex items-start gap-2 mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <span className="text-indigo-600 font-semibold text-xs mt-0.5">
                      💡 TIP:
                    </span>
                    <p className="text-xs text-indigo-700 leading-relaxed">
                      Use placeholders like{" "}
                      <code className="px-1.5 py-0.5 bg-white border border-indigo-200 rounded font-mono text-indigo-800">
                        [Name]
                      </code>
                      ,{" "}
                      <code className="px-1.5 py-0.5 bg-white border border-indigo-200 rounded font-mono text-indigo-800">
                        [Email]
                      </code>
                      ,{" "}
                      <code className="px-1.5 py-0.5 bg-white border border-indigo-200 rounded font-mono text-indigo-800">
                        [Company]
                      </code>{" "}
                      for personalization
                    </p>
                  </div>
                </div>
              </div>

              {/* Preview Section */}
              <div className="space-y-4">
                <div className="sticky top-0">
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-semibold text-gray-700">
                      Live Email Preview
                    </label>
                    <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                      <button
                        onClick={() => setPreviewMode("desktop")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200 text-sm font-medium ${
                          previewMode === "desktop"
                            ? "bg-white text-indigo-600 shadow-md"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        <Monitor size={16} />
                        Desktop
                      </button>
                      <button
                        onClick={() => setPreviewMode("mobile")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200 text-sm font-medium ${
                          previewMode === "mobile"
                            ? "bg-white text-indigo-600 shadow-md"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        <Smartphone size={16} />
                        Mobile
                      </button>
                    </div>
                  </div>

                  {/* Email Preview Box */}
                  <div
                    className={`bg-white border-2 border-gray-300 rounded-xl overflow-hidden shadow-lg transition-all duration-300 ${
                      previewMode === "mobile" ? "max-w-[375px] mx-auto" : ""
                    }`}
                  >
                    {/* Email Header */}
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200 p-5">
                      <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                        Subject:
                      </div>
                      <div className="font-semibold text-gray-800 text-lg">
                        {templateSubject || "Email Subject Preview"}
                      </div>
                    </div>

                    {/* Email Body */}
                    <div className="bg-white p-8 min-h-[500px]">
                      {emailContent ? (
                        <div className="space-y-4">
                          {emailContent.split("\n").map((line, index) => {
                            // Check if line is a bullet point
                            if (line.trim().startsWith("•")) {
                              return (
                                <div
                                  key={index}
                                  className="flex gap-3 items-start"
                                >
                                  <span className="text-indigo-600 font-bold">
                                    •
                                  </span>
                                  <span className="text-gray-700 leading-relaxed">
                                    {line.trim().substring(1).trim()}
                                  </span>
                                </div>
                              );
                            }
                            // Check if line looks like a link
                            if (
                              line.trim() &&
                              (line.includes("http") ||
                                line.toLowerCase().includes("guide") ||
                                line.toLowerCase().includes("page"))
                            ) {
                              return (
                                <a
                                  key={index}
                                  href="#"
                                  className="text-indigo-600 hover:text-indigo-700 hover:underline block font-medium transition-colors"
                                >
                                  {line.trim()}
                                </a>
                              );
                            }
                            // Regular paragraph
                            return line.trim() ? (
                              <p
                                key={index}
                                className="text-gray-800 leading-relaxed"
                              >
                                {line}
                              </p>
                            ) : (
                              <div key={index} className="h-3"></div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center text-gray-400 py-20">
                          <Mail size={56} className="mx-auto mb-4 opacity-30" />
                          <p className="text-lg font-medium">
                            Your email preview will appear here
                          </p>
                          <p className="text-sm mt-2 text-gray-400">
                            Start typing to see the preview
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Email Footer */}
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-5 border-t-2 border-gray-200">
                      <p className="text-xs text-gray-600 text-center font-medium">
                        📧 This is a preview of your email template
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="flex items-center justify-between px-8 py-6 border-t-2 border-gray-200 bg-gray-50">
              <button
                onClick={() => navigate("/templates")}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-white hover:shadow-md transition-all duration-200 font-medium"
              >
                Cancel
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="px-6 py-3 border-2 border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 hover:shadow-md transition-all duration-200 font-medium"
                >
                  Save as Draft
                </button>
                <button
                  onClick={handleSave}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 hover:shadow-lg transition-all duration-200 font-medium flex items-center gap-2"
                >
                  <Save size={18} />
                  Save & Publish
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default TemplateBuilder;
