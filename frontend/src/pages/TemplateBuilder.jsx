import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Monitor, Smartphone } from "lucide-react";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";
import RichTextEditor from "../components/RichTextEditor.jsx";

const defaultContent = "";
const MIN_PREVIEW_HEIGHT = 240;
const MAX_PREVIEW_HEIGHT = 1400;
const MOBILE_PREVIEW_CONTENT_WIDTH = 375;

const isRichTextEmpty = (html = "") => {
  const plainText = html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  return plainText.length === 0;
};

const hasUnsubscribeMarkup = (html = "") =>
  /(\{\{\s*unsubscribe_url\s*\}\}|\/unsubscribe\b|>\s*unsubscribe\s*<)/i.test(
    String(html || ""),
  );

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
  const [editorMode, setEditorMode] = useState("rich"); // "rich" or "html"
  const [iframeHeight, setIframeHeight] = useState(500);
  const [iframeScale, setIframeScale] = useState(1);
  const [iframeContentHeight, setIframeContentHeight] = useState(500);
  const [iframeContentWidth, setIframeContentWidth] = useState(700);
  const [showHtmlWarning, setShowHtmlWarning] = useState(false);
  const [showVisualToHtmlWarning, setShowVisualToHtmlWarning] = useState(false);
  const previewViewportRef = useRef(null);
  const previewIframeRef = useRef(null);

  const updatePreviewLayout = () => {
    const iframe = previewIframeRef.current;
    const viewport = previewViewportRef.current;

    if (!iframe || !viewport || !iframe.contentWindow) {
      return;
    }

    try {
      const doc = iframe.contentWindow.document;
      const bodyHeight = Math.max(
        doc.body?.scrollHeight || 0,
        Math.ceil(doc.body?.getBoundingClientRect?.().height || 0),
      );
      const htmlHeight = Math.max(
        doc.documentElement?.scrollHeight || 0,
        Math.ceil(doc.documentElement?.getBoundingClientRect?.().height || 0),
      );

      // Prefer body-based sizing; only trust html height when it is a near match.
      // This avoids rare runaway documentElement heights that stretch the page.
      let contentHeight = Math.max(bodyHeight, MIN_PREVIEW_HEIGHT);
      if (htmlHeight > 0 && htmlHeight <= contentHeight * 1.25) {
        contentHeight = Math.max(contentHeight, htmlHeight);
      }

      const contentWidth = Math.max(
        doc.body?.scrollWidth || 0,
        doc.documentElement?.scrollWidth || 0,
      );

      if (!contentHeight || !contentWidth) {
        return;
      }

      const targetContentWidth =
        previewMode === "mobile" ? MOBILE_PREVIEW_CONTENT_WIDTH : contentWidth;
      const viewportWidth = viewport.clientWidth || targetContentWidth;
      const nextScale = Math.min(1, viewportWidth / targetContentWidth);

      setIframeScale(nextScale);
      setIframeContentHeight(contentHeight);
      setIframeContentWidth(targetContentWidth);
      const scaledHeight = Math.max(
        MIN_PREVIEW_HEIGHT,
        Math.ceil(contentHeight * nextScale),
      );
      setIframeHeight(Math.min(MAX_PREVIEW_HEIGHT, scaledHeight));
    } catch (err) {
      console.error("Failed to update preview layout:", err);
    }
  };

  const isHtmlContent = (content) => {
    const trimmed = content.trim().toLowerCase();
    return (
      trimmed.startsWith("<!doctype") ||
      trimmed.startsWith("<html") ||
      /<\w+[^>]*>/i.test(content)
    );
  };

  const applyPreviewMergeTags = (content = "") =>
    String(content || "")
      .replace(/\{\{\s*name\s*\}\}/gi, "John Doe")
      .replace(/\{\{\s*email\s*\}\}/gi, "john.doe@example.com")
      .replace(/\{\{\s*unsubscribe_url\s*\}\}/gi, "/unsubscribe");

  const switchToRichEditor = () => {
    // If the current content is raw HTML, show a warning
    if (
      editorMode === "html" &&
      emailContent.trim() &&
      isHtmlContent(emailContent)
    ) {
      setShowHtmlWarning(true);
      return;
    }
    setEditorMode("rich");
  };

  const handleHtmlWarningContinue = () => {
    // Clear the editor and switch to rich mode
    setEmailContent("");
    setEditorMode("rich");
    setShowHtmlWarning(false);
  };

  const handleHtmlWarningCancel = () => {
    // Close the warning and stay in HTML mode
    setShowHtmlWarning(false);
  };

  const switchToHtmlEditor = () => {
    if (editorMode === "rich") {
      setShowVisualToHtmlWarning(true);
      return;
    }

    setEditorMode("html");
  };

  const handleVisualToHtmlContinue = () => {
    setEditorMode("html");
    setShowVisualToHtmlWarning(false);
  };

  const handleVisualToHtmlCancel = () => {
    setShowVisualToHtmlWarning(false);
  };

  const handleIframeLoad = (e) => {
    previewIframeRef.current = e.target;
    setTimeout(updatePreviewLayout, 100);
    setTimeout(updatePreviewLayout, 360);
  };

  useEffect(() => {
    const timers = [80, 220, 420].map((delay) =>
      setTimeout(updatePreviewLayout, delay),
    );

    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [emailContent, previewMode]);

  useEffect(() => {
    const handleResize = () => updatePreviewLayout();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const viewport = previewViewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(() => updatePreviewLayout());
    });

    observer.observe(viewport);

    return () => observer.disconnect();
  }, []);

  const getPreviewHtml = () => {
    const previewContent = applyPreviewMergeTags(emailContent);

    const ensureViewportMeta = (html) => {
      if (/<meta\s+name=["']viewport["']/i.test(html)) {
        return html;
      }

      if (/<head[^>]*>/i.test(html)) {
        return html.replace(
          /<head[^>]*>/i,
          (match) =>
            `${match}\n<meta name="viewport" content="width=device-width, initial-scale=1" />`,
        );
      }

      return html;
    };

    const unsubscribeFooter = `
      <p style="margin:24px 0 0 0;text-align:center;font-size:12px;line-height:1.5;color:#9ca3af;font-family:sans-serif;">
        You are receiving these emails because you are subscribed to our email updates.<br/>
        <a href='/unsubscribe' style="color:#6366f1;text-decoration:underline;" target="_blank">Unsubscribe</a>
      </p>
    `;
    const shouldAddFooter = !hasUnsubscribeMarkup(previewContent);

    if (!previewContent) {
      return `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <style>
              body {
                margin: 0;
                padding: 0;
                font-family: sans-serif;
                font-size: 13px;
                color: #222;
              }
            </style>
          </head>
          <body>${shouldAddFooter ? unsubscribeFooter : ""}</body>
        </html>
      `;
    }

    const trimmed = previewContent.trim().toLowerCase();
    if (trimmed.startsWith("<!doctype") || trimmed.startsWith("<html")) {
      if (/<\/body>/i.test(previewContent)) {
        if (!shouldAddFooter) {
          return ensureViewportMeta(previewContent);
        }
        return ensureViewportMeta(
          previewContent.replace(/<\/body>/i, `${unsubscribeFooter}</body>`),
        );
      }

      return ensureViewportMeta(
        shouldAddFooter
          ? `${previewContent}${unsubscribeFooter}`
          : previewContent,
      );
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            body { 
              margin: 0; 
              padding: 0; 
              font-family: sans-serif;
              font-size: 13px;
              color: #222;
            }
            * { box-sizing: border-box; }
            img { max-width: 100%; height: auto; }
            a img { display: inline-block; vertical-align: middle; }
            .preview-content * { font-size: 13px !important; }
            .preview-content { font-size: 13px !important; }
            a { color: #6366f1; }
          </style>
        </head>
        <body>
          <div class="preview-content">${previewContent}</div>
          ${shouldAddFooter ? unsubscribeFooter : ""}
        </body>
      </html>
    `;
  };

  useEffect(() => {
    if (editTemplate) {
      setTemplateName(editTemplate.template_name);
      setTemplateSubject(editTemplate.template_subject);
      setEmailContent(editTemplate.template_body);
      // Preserve editor mode: detect if template body is HTML or rich text
      if (
        editTemplate.template_body &&
        isHtmlContent(editTemplate.template_body)
      ) {
        setEditorMode("html");
      } else {
        setEditorMode("rich");
      }
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
    <div className="flex min-h-screen bg-gray-50 text-gray-900 font-sans">
      <Sidebar />

      {/* HTML Content Warning Modal */}
      {showHtmlWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 max-w-md p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Switch to Visual Editor?
              </h3>
              <p className="text-sm text-gray-600 mt-2">
                The current HTML content cannot be properly converted to the
                Visual Editor. The editor will be cleared when you switch. Do
                you want to continue?
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleHtmlWarningCancel}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleHtmlWarningContinue}
                className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {showVisualToHtmlWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 max-w-md p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Switch to HTML Code?
              </h3>
              <p className="text-sm text-gray-600 mt-2">
                If you switch from Visual Editor to HTML Code, the HTML editor
                will be blank. Do you want to continue?
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleVisualToHtmlCancel}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleVisualToHtmlContinue}
                className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 ml-64 overflow-y-auto">
        <main className="p-6 lg:p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">
              {editTemplate ? "Edit Email Template" : "Add New Email Template"}
            </h1>
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-5 items-start">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:p-5 space-y-5">
              <h2 className="text-sm font-semibold text-gray-800">
                Email Template Information
              </h2>

              <div className="space-y-5">
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                    <span className="font-bold">Error:</span> {error}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Name
                    </label>
                    <div className="relative rounded-lg border border-gray-200 bg-white transition-all focus-within:border-indigo-300">
                      <input
                        type="text"
                        value={templateName}
                        onChange={(event) =>
                          setTemplateName(event.target.value)
                        }
                        placeholder="Enter name of Template"
                        className="w-full rounded-lg border-none bg-transparent px-3 py-2.5 text-sm text-gray-700 placeholder:text-gray-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Subject
                    </label>
                    <div className="relative rounded-lg border border-gray-200 bg-white transition-all focus-within:border-indigo-300">
                      <input
                        type="text"
                        value={templateSubject}
                        onChange={(event) =>
                          setTemplateSubject(event.target.value)
                        }
                        placeholder="Enter subject"
                        className="w-full rounded-lg border-none bg-transparent px-3 py-2.5 text-sm text-gray-700 placeholder:text-gray-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-xs font-medium text-gray-700">
                      Body
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                        <button
                          onClick={switchToRichEditor}
                          className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                            editorMode === "rich"
                              ? "bg-white text-indigo-600 shadow-sm"
                              : "text-gray-400 hover:text-gray-600"
                          }`}
                        >
                          Visual Editor
                        </button>
                        <button
                          onClick={switchToHtmlEditor}
                          className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                            editorMode === "html"
                              ? "bg-white text-indigo-600 shadow-sm"
                              : "text-gray-400 hover:text-gray-600"
                          }`}
                        >
                          HTML Code
                        </button>
                      </div>
                    </div>
                  </div>

                  {editorMode === "rich" ? (
                    <div className="relative rounded-lg border border-gray-200 bg-white transition-all focus-within:border-indigo-300 overflow-hidden">
                      <RichTextEditor
                        value={emailContent}
                        onChange={setEmailContent}
                        placeholder="Enter body"
                      />
                    </div>
                  ) : (
                    <div className="relative rounded-lg border border-gray-200 bg-white transition-all focus-within:border-indigo-300 overflow-hidden">
                      <textarea
                        value={emailContent}
                        onChange={(e) => setEmailContent(e.target.value)}
                        className="block h-80 w-full border-none bg-gray-900 px-4 py-3.5 text-[13px] font-mono leading-relaxed text-gray-100 focus:outline-none overflow-auto resize-y [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                        placeholder="Enter body"
                        spellCheck="false"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-1">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {isSaving
                      ? "Saving..."
                      : editTemplate
                        ? "Update Email Template"
                        : "Add Template"}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 lg:p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 text-sm text-gray-700 font-medium">
                  <Monitor className="h-4 w-4 text-gray-500" />
                  Preview
                </div>
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

              <div className="mb-2 border-t border-gray-200 pt-2">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {templateSubject}
                </p>
              </div>

              <div className="overflow-hidden mx-auto transition-all duration-300 max-w-175 rounded-none border-0 shadow-none">
                <div
                  ref={previewViewportRef}
                  className={`bg-white relative overflow-hidden ${
                    previewMode === "mobile" ? "flex justify-center" : "block"
                  }`}
                  style={{ height: `${iframeHeight}px` }}
                >
                  <iframe
                    ref={previewIframeRef}
                    title="Template Preview"
                    onLoad={handleIframeLoad}
                    srcDoc={getPreviewHtml()}
                    className="w-full border-none transition-all duration-300"
                    style={{
                      width: `${iframeContentWidth}px`,
                      height: `${iframeContentHeight}px`,
                      transform: `scale(${iframeScale})`,
                      transformOrigin:
                        previewMode === "mobile" ? "top center" : "top left",
                      fontSize: "13px",
                      overflow: "hidden",
                    }}
                    scrolling="no"
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
