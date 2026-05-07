import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Eye } from "lucide-react";
import Sidebar from "../components/Sidebar.jsx";
import api from "../lib/api.js";
import RichTextEditor from "../components/RichTextEditor.jsx";

const VISUAL_TEMPLATE_MARKER_START = "<!-- VISUAL_BASE_CONTENT_START -->";
const VISUAL_TEMPLATE_MARKER_END = "<!-- VISUAL_BASE_CONTENT_END -->";
const defaultContent = "";
const MIN_PREVIEW_HEIGHT = 240;
const MAX_PREVIEW_HEIGHT = 1400;
const MOBILE_PREVIEW_CONTENT_WIDTH = 375;

const buildVisualBaseTemplate = (innerHtml = "", extraFooter = "") => {
  const content = String(innerHtml || "").trim();

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Email Template</title>
    <style>
      img[data-image-align="left"] { display: block; margin-left: 0; margin-right: auto; }
      img[data-image-align="center"] { display: block; margin-left: auto; margin-right: auto; }
      img[data-image-align="right"] { display: block; margin-left: auto; margin-right: 0; }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#eef2f7;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eef2f7;padding:24px 12px;font-family:Arial,sans-serif;color:#1f2937;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="680" style="max-width:680px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:24px;font-size:14px;line-height:1.65;color:#334155;">
                ${VISUAL_TEMPLATE_MARKER_START}
                ${content}
                ${VISUAL_TEMPLATE_MARKER_END}
              </td>
            </tr>
          </table>
          ${extraFooter}
        </td>
      </tr>
    </table>
  </body>
</html>
`;
};

const extractVisualTemplateInnerHtml = (html = "") => {
  const source = String(html || "");
  const startIndex = source.indexOf(VISUAL_TEMPLATE_MARKER_START);
  const endIndex = source.indexOf(VISUAL_TEMPLATE_MARKER_END);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return null;
  }

  const contentStart = startIndex + VISUAL_TEMPLATE_MARKER_START.length;
  return source.slice(contentStart, endIndex).trim();
};

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
  const { templateId } = useParams();
  const [editTemplate, setEditTemplate] = useState(
    location.state?.template || null,
  );

  const [templateName, setTemplateName] = useState("");
  const [templateSubject, setTemplateSubject] = useState("");
  const [emailContent, setEmailContent] = useState(defaultContent);
  const previewMode = "desktop";
  const [error, setError] = useState("");
  const [showRequired, setShowRequired] = useState(false);
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
      .replace(/\{\{\s*name\s*\}\}/gi, "{{name}}")
      .replace(/\{\{\s*email\s*\}\}/gi, "john.doe@example.com")
      .replace(/\{\{\s*unsubscribe_url\s*\}\}/gi, "/unsubscribe");

  const switchToRichEditor = () => {
    if (editorMode === "html" && !isRichTextEmpty(emailContent)) {
      setShowHtmlWarning(true);
      return;
    }
    setEditorMode("rich");
  };

  const handleHtmlWarningContinue = () => {
    // Reset the editable area to the visual-editor default body.
    setEmailContent(defaultContent);
    setEditorMode("rich");
    setShowHtmlWarning(false);
  };

  const handleHtmlWarningCancel = () => {
    // Close the warning and stay in HTML mode
    setShowHtmlWarning(false);
  };

  const switchToHtmlEditor = () => {
    if (editorMode === "rich" && !isRichTextEmpty(emailContent)) {
      setShowVisualToHtmlWarning(true);
      return;
    }

    setEditorMode("html");
  };

  const handleVisualToHtmlContinue = () => {
    setEmailContent(defaultContent);
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

    if (editorMode === "rich") {
      return buildVisualBaseTemplate(
        previewContent,
        shouldAddFooter ? unsubscribeFooter : "",
      );
    }

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
    const stateTemplate = location.state?.template || null;

    if (stateTemplate && !templateId) {
      setEditTemplate(stateTemplate);
      return;
    }

    if (!templateId) {
      setEditTemplate(null);
      return;
    }

    let cancelled = false;

    const fetchTemplate = async () => {
      try {
        const response = await api.get(`/templates/${templateId}`);
        if (!cancelled) {
          setEditTemplate(response.data || null);
        }
      } catch (requestError) {
        if (!cancelled) {
          setEditTemplate(null);
          setError(
            requestError.response?.data?.message || "Failed to load template",
          );
        }
      }
    };

    fetchTemplate();

    return () => {
      cancelled = true;
    };
  }, [templateId, location.state]);

  useEffect(() => {
    if (editTemplate) {
      setTemplateName(editTemplate.template_name);
      setTemplateSubject(editTemplate.template_subject);

      const extractedVisualContent = extractVisualTemplateInnerHtml(
        editTemplate.template_body,
      );

      if (extractedVisualContent !== null) {
        setEmailContent(extractedVisualContent || defaultContent);
        setEditorMode("rich");
      } else {
        setEmailContent(editTemplate.template_body);
        if (
          editTemplate.template_body &&
          isHtmlContent(editTemplate.template_body)
        ) {
          setEditorMode("html");
        } else {
          setEditorMode("rich");
        }
      }
    } else {
      setTemplateName("");
      setTemplateSubject("");
      setEmailContent(defaultContent);
      setEditorMode("rich");
    }
  }, [editTemplate]);

  const getContentForSave = () => {
    if (editorMode === "rich") {
      return buildVisualBaseTemplate(emailContent);
    }

    return emailContent.trim();
  };

  const handleSave = async () => {
    setShowRequired(true);
    setError("");

    if (
      !templateName.trim() ||
      !templateSubject.trim() ||
      isRichTextEmpty(emailContent)
    ) {
      return;
    }

    setIsSaving(true);

    const payload = {
      template_name: templateName.trim(),
      template_subject: templateSubject.trim(),
      template_body: getContentForSave(),
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

  const nameRequired = showRequired && !templateName.trim();
  const subjectRequired = showRequired && !templateSubject.trim();
  const bodyRequired = showRequired && isRichTextEmpty(emailContent);

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
                If you switch from HTML Code to Visual Editor, the Visual editor
                will be blank. Do you want to continue?
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
            <div className="bg-white rounded-md border border-gray-200 p-4 lg:p-5 space-y-5">
              <h2 className="text-sm font-semibold text-gray-800">
                Email Template Information
              </h2>

              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Name
                    </label>
                    <div
                      className={`relative rounded-md border bg-white transition-all ${
                        nameRequired
                          ? "border-red-400 focus-within:border-red-400"
                          : "border-gray-200 focus-within:border-indigo-300"
                      }`}
                    >
                      <input
                        type="text"
                        value={templateName}
                        onChange={(event) => {
                          setTemplateName(event.target.value);
                          setError("");
                        }}
                        placeholder="Enter name of Template"
                        className="w-full rounded-md border-none bg-transparent px-3 py-2.5 text-sm text-gray-700 placeholder:text-gray-500 focus:outline-none"
                      />
                    </div>
                    {nameRequired && (
                      <p className="mt-1 text-sm text-red-500">Required</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Subject
                    </label>
                    <div
                      className={`relative rounded-md border bg-white transition-all ${
                        subjectRequired
                          ? "border-red-400 focus-within:border-red-400"
                          : "border-gray-200 focus-within:border-indigo-300"
                      }`}
                    >
                      <input
                        type="text"
                        value={templateSubject}
                        onChange={(event) => {
                          setTemplateSubject(event.target.value);
                          setError("");
                        }}
                        placeholder="Enter subject"
                        className="w-full rounded-md border-none bg-transparent px-3 py-2.5 text-sm text-gray-700 placeholder:text-gray-500 focus:outline-none"
                      />
                    </div>
                    {subjectRequired && (
                      <p className="mt-1 text-sm text-red-500">Required</p>
                    )}
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
                    <div
                      className={`relative rounded-lg border bg-white transition-all overflow-hidden ${
                        bodyRequired
                          ? "border-red-400 focus-within:border-red-400"
                          : "border-gray-200 focus-within:border-indigo-300"
                      }`}
                    >
                      <RichTextEditor
                        value={emailContent}
                        onChange={setEmailContent}
                        placeholder="Enter body"
                      />
                    </div>
                  ) : (
                    <div
                      className={`relative rounded-lg border bg-white transition-all overflow-hidden ${
                        bodyRequired
                          ? "border-red-400 focus-within:border-red-400"
                          : "border-gray-200 focus-within:border-indigo-300"
                      }`}
                    >
                      <textarea
                        value={emailContent}
                        onChange={(e) => {
                          setEmailContent(e.target.value);
                          setError("");
                        }}
                        className="block h-80 w-full border-none bg-gray-900 px-4 py-3.5 text-[13px] font-mono leading-relaxed text-gray-100 focus:outline-none overflow-auto resize-y [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                        placeholder="Enter body"
                        spellCheck="false"
                      />
                    </div>
                  )}
                  {bodyRequired && (
                    <p className="mt-1 text-sm text-red-500">Required</p>
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
                  {error && (
                    <p className="mt-2 text-sm text-red-500">{error}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-md border border-gray-200 p-3 lg:p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 text-sm text-gray-700 font-medium">
                  <Eye className="h-4 w-4 text-gray-500" />
                  Preview
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
