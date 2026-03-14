import React, { useEffect, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import Color from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import ImageResize from "tiptap-extension-resize-image";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  MousePointerClick,
  Paintbrush,
  Redo2,
  Undo2,
} from "lucide-react";

const ToolbarButton = ({ onClick, isActive = false, title, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-700 transition-colors ${
      isActive ? "bg-gray-900 text-white" : "hover:bg-gray-100"
    }`}
  >
    {children}
  </button>
);

const CtaButton = Node.create({
  name: "ctaButton",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      text: {
        default: "Verify Email",
        parseHTML: (element) => {
          const link = element.querySelector("a[data-cta-button]");
          return link?.textContent || "Verify Email";
        },
      },
      href: {
        default: "https://example.com/verify",
        parseHTML: (element) => {
          const link = element.querySelector("a[data-cta-button]");
          return link?.getAttribute("href") || "https://example.com/verify";
        },
      },
      bgColor: {
        default: "#111827",
        parseHTML: (element) => {
          const link = element.querySelector("a[data-cta-button]");
          return link?.getAttribute("data-bg-color") || "#111827";
        },
      },
      textColor: {
        default: "#ffffff",
        parseHTML: (element) => {
          const link = element.querySelector("a[data-cta-button]");
          return link?.getAttribute("data-text-color") || "#ffffff";
        },
      },
      align: {
        default: "center",
        parseHTML: (element) => element.getAttribute("data-align") || "center",
      },
      radius: {
        default: 8,
        parseHTML: (element) => {
          const link = element.querySelector("a[data-cta-button]");
          const value = Number(link?.getAttribute("data-radius") || 8);
          return Number.isNaN(value) ? 8 : value;
        },
      },
      fontSize: {
        default: 14,
        parseHTML: (element) => {
          const link = element.querySelector("a[data-cta-button]");
          const value = Number(link?.getAttribute("data-font-size") || 14);
          return Number.isNaN(value) ? 14 : value;
        },
      },
      width: {
        default: 0,
        parseHTML: (element) => {
          const link = element.querySelector("a[data-cta-button]");
          const value = Number(link?.getAttribute("data-width") || 0);
          return Number.isNaN(value) ? 0 : value;
        },
      },
      paddingX: {
        default: 18,
        parseHTML: (element) => {
          const link = element.querySelector("a[data-cta-button]");
          const value = Number(link?.getAttribute("data-padding-x") || 18);
          return Number.isNaN(value) ? 18 : value;
        },
      },
      paddingY: {
        default: 12,
        parseHTML: (element) => {
          const link = element.querySelector("a[data-cta-button]");
          const value = Number(link?.getAttribute("data-padding-y") || 12);
          return Number.isNaN(value) ? 12 : value;
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "p[data-cta-wrapper='true']" }];
  },

  renderHTML({ HTMLAttributes }) {
    const {
      text,
      href,
      bgColor,
      textColor,
      align,
      radius,
      fontSize,
      width,
      paddingX,
      paddingY,
    } = HTMLAttributes;

    const marginStyle =
      align === "left"
        ? "16px auto 16px 0"
        : align === "right"
          ? "16px 0 16px auto"
          : "16px auto";

    const widthStyle = Number(width) > 0 ? `width:${Number(width)}px;` : "";

    return [
      "p",
      mergeAttributes({
        "data-cta-wrapper": "true",
        "data-align": align,
        style: `margin: 0; text-align: ${align};`,
      }),
      [
        "a",
        {
          href,
          target: "_blank",
          rel: "noopener noreferrer",
          "data-cta-button": "true",
          "data-bg-color": bgColor,
          "data-text-color": textColor,
          "data-radius": radius,
          "data-font-size": fontSize,
          "data-width": width,
          "data-padding-x": paddingX,
          "data-padding-y": paddingY,
          style: `display:inline-block; ${widthStyle} background:${bgColor}; color:${textColor}; text-decoration:none; text-align:center; font-size:${fontSize}px; font-weight:600; line-height:1.2; padding:${paddingY}px ${paddingX}px; border-radius:${radius}px; margin:${marginStyle}; box-sizing:border-box;`,
        },
        text,
      ],
    ];
  },

  addCommands() {
    return {
      insertCtaButton:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
      updateCtaButton:
        (attrs) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, attrs),
    };
  },
});

const RichTextEditor = ({ value, onChange, placeholder = "Write here..." }) => {
  const [hasSelectedCta, setHasSelectedCta] = useState(false);
  const [textColor, setTextColor] = useState("#111827");

  const [ctaText, setCtaText] = useState("Verify Email");
  const [ctaUrl, setCtaUrl] = useState("https://example.com/verify");
  const [ctaBgColor, setCtaBgColor] = useState("#111827");
  const [ctaTextColor, setCtaTextColor] = useState("#ffffff");
  const [ctaAlign, setCtaAlign] = useState("center");
  const [ctaRadius, setCtaRadius] = useState(8);
  const [ctaFontSize, setCtaFontSize] = useState(14);
  const [ctaWidth, setCtaWidth] = useState(0);
  const [ctaPaddingX, setCtaPaddingX] = useState(18);
  const [ctaPaddingY, setCtaPaddingY] = useState(12);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Link.configure({
        autolink: true,
        linkOnPaste: true,
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      ImageResize.configure({
        inline: false,
        minWidth: 80,
        maxWidth: 900,
      }),
      CtaButton,
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "tiptap prose prose-sm max-w-none min-h-40 px-4 py-3 focus:outline-none",
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChange(instance.getHTML());
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const currentHtml = editor.getHTML();
    if ((value || "") !== currentHtml) {
      editor.commands.setContent(value || "", false);
    }
  }, [editor, value]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const syncControls = () => {
      const ctaSelected = editor.isActive("ctaButton");
      setHasSelectedCta(ctaSelected);

      if (ctaSelected) {
        const attrs = editor.getAttributes("ctaButton");
        setCtaText(attrs.text || "Verify Email");
        setCtaUrl(attrs.href || "https://example.com/verify");
        setCtaBgColor(attrs.bgColor || "#111827");
        setCtaTextColor(attrs.textColor || "#ffffff");
        setCtaAlign(attrs.align || "center");
        setCtaRadius(Number(attrs.radius || 8));
        setCtaFontSize(Number(attrs.fontSize || 14));
        setCtaWidth(Number(attrs.width || 0));
        setCtaPaddingX(Number(attrs.paddingX || 18));
        setCtaPaddingY(Number(attrs.paddingY || 12));
      }

      const currentColor = editor.getAttributes("textStyle").color;
      if (currentColor) {
        setTextColor(currentColor);
      }
    };

    syncControls();
    editor.on("selectionUpdate", syncControls);
    editor.on("update", syncControls);

    return () => {
      editor.off("selectionUpdate", syncControls);
      editor.off("update", syncControls);
    };
  }, [editor]);

  const insertImageFromUrl = () => {
    if (!editor) {
      return;
    }

    const url = window.prompt("Enter image URL");
    if (!url || !url.trim()) {
      return;
    }

    editor.chain().focus().setImage({ src: url.trim() }).run();
  };

  const insertCtaButton = () => {
    if (!editor) {
      return;
    }

    const promptedText = window.prompt("CTA text", ctaText || "Verify Email");
    if (promptedText === null) {
      return;
    }

    const cleanText = promptedText.trim();
    if (!cleanText) {
      window.alert("CTA text is required.");
      return;
    }

    const promptedUrl = window.prompt(
      "CTA link URL",
      ctaUrl || "https://example.com/verify",
    );
    if (promptedUrl === null) {
      return;
    }

    const cleanUrl = promptedUrl.trim();
    if (!cleanUrl) {
      window.alert("CTA URL is required.");
      return;
    }

    // Keep the control panel in sync with the just-inserted CTA.
    setCtaText(cleanText);
    setCtaUrl(cleanUrl);

    editor
      .chain()
      .focus()
      .insertCtaButton({
        text: cleanText,
        href: cleanUrl,
        bgColor: ctaBgColor,
        textColor: ctaTextColor,
        align: ctaAlign,
        radius: ctaRadius,
        fontSize: ctaFontSize,
        width: ctaWidth,
        paddingX: ctaPaddingX,
        paddingY: ctaPaddingY,
      })
      .run();
  };

  const setLinkForSelection = () => {
    if (!editor) {
      return;
    }

    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    const previousUrl = editor.getAttributes("link").href || "https://";
    const url = window.prompt("Enter hyperlink URL", previousUrl);

    if (url === null) {
      return;
    }

    if (!url.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url.trim() })
      .run();
  };

  useEffect(() => {
    if (!editor || !hasSelectedCta) {
      return;
    }

    const attrs = editor.getAttributes("ctaButton");
    const nextAttrs = {
      text: ctaText,
      href: ctaUrl,
      bgColor: ctaBgColor,
      textColor: ctaTextColor,
      align: ctaAlign,
      radius: ctaRadius,
      fontSize: ctaFontSize,
      width: ctaWidth,
      paddingX: ctaPaddingX,
      paddingY: ctaPaddingY,
    };

    const isSame =
      (attrs.text || "") === nextAttrs.text &&
      (attrs.href || "") === nextAttrs.href &&
      (attrs.bgColor || "") === nextAttrs.bgColor &&
      (attrs.textColor || "") === nextAttrs.textColor &&
      (attrs.align || "") === nextAttrs.align &&
      Number(attrs.radius || 8) === Number(nextAttrs.radius) &&
      Number(attrs.fontSize || 14) === Number(nextAttrs.fontSize) &&
      Number(attrs.width || 0) === Number(nextAttrs.width) &&
      Number(attrs.paddingX || 18) === Number(nextAttrs.paddingX) &&
      Number(attrs.paddingY || 12) === Number(nextAttrs.paddingY);

    if (isSame) {
      return;
    }

    editor.chain().focus().updateCtaButton(nextAttrs).run();
  }, [
    editor,
    hasSelectedCta,
    ctaText,
    ctaUrl,
    ctaBgColor,
    ctaTextColor,
    ctaAlign,
    ctaRadius,
    ctaFontSize,
    ctaWidth,
    ctaPaddingX,
    ctaPaddingY,
  ]);

  const applyCtaPreset = (preset) => {
    if (preset === "sm") {
      setCtaFontSize(12);
      setCtaPaddingX(14);
      setCtaPaddingY(9);
      setCtaRadius(6);
      setCtaWidth(0);
      return;
    }

    if (preset === "md") {
      setCtaFontSize(14);
      setCtaPaddingX(18);
      setCtaPaddingY(12);
      setCtaRadius(8);
      setCtaWidth(0);
      return;
    }

    setCtaFontSize(16);
    setCtaPaddingX(22);
    setCtaPaddingY(14);
    setCtaRadius(10);
    setCtaWidth(240);
  };

  if (!editor) {
    return (
      <div className="min-h-40 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-500">
        Loading editor...
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-300 bg-white">
      <div className="flex flex-nowrap items-center gap-1 overflow-x-auto border-b border-gray-200 bg-white px-2 py-1.5">
        <ToolbarButton
          title="Undo"
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Redo"
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Bold"
          isActive={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Italic"
          isActive={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title={editor.isActive("link") ? "Remove hyperlink" : "Add hyperlink"}
          isActive={editor.isActive("link")}
          onClick={setLinkForSelection}
        >
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        <div className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-200 px-1.5 py-1">
          <Paintbrush className="h-3.5 w-3.5 text-gray-500" />
          <input
            type="color"
            value={textColor}
            onChange={(event) => {
              const next = event.target.value;
              setTextColor(next);
              editor.chain().focus().setColor(next).run();
            }}
            className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
            title="Text color"
          />
        </div>
        <ToolbarButton
          title="Heading 1"
          isActive={editor.isActive("heading", { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <div className="mx-1 h-5 w-px bg-gray-200" />
        <ToolbarButton
          title="Align left"
          isActive={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Align center"
          isActive={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Align right"
          isActive={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Justify"
          isActive={editor.isActive({ textAlign: "justify" })}
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        >
          <AlignJustify className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Bullet list"
          isActive={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Ordered list"
          isActive={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <div className="mx-1 h-5 w-px bg-gray-200" />
        <ToolbarButton title="Insert image by URL" onClick={insertImageFromUrl}>
          <ImagePlus className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Insert CTA button" onClick={insertCtaButton}>
          <MousePointerClick className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />

      {hasSelectedCta && (
        <div className="border-t border-gray-100 bg-gray-50 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-600">
              CTA Controls
            </span>
            <input
              type="text"
              value={ctaText}
              onChange={(event) => setCtaText(event.target.value)}
              placeholder="Button text"
              className="h-7 w-32 rounded border border-gray-200 bg-white px-2 text-xs text-gray-700"
            />
            <input
              type="text"
              value={ctaUrl}
              onChange={(event) => setCtaUrl(event.target.value)}
              placeholder="Button link"
              className="h-7 w-52 rounded border border-gray-200 bg-white px-2 text-xs text-gray-700"
            />
            <span className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-500">
              Live update
            </span>
            <label className="inline-flex items-center gap-1 text-xs text-gray-500">
              BG
              <input
                type="color"
                value={ctaBgColor}
                onChange={(event) => setCtaBgColor(event.target.value)}
                className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
              />
            </label>
            <label className="inline-flex items-center gap-1 text-xs text-gray-500">
              Text
              <input
                type="color"
                value={ctaTextColor}
                onChange={(event) => setCtaTextColor(event.target.value)}
                className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
              />
            </label>
            <label className="inline-flex items-center gap-1 text-xs text-gray-500">
              W
              <input
                type="number"
                min="0"
                max="700"
                value={ctaWidth}
                onChange={(event) =>
                  setCtaWidth(Number(event.target.value || 0))
                }
                className="h-7 w-14 rounded border border-gray-200 bg-white px-1 text-xs text-gray-700"
              />
            </label>
            <label className="inline-flex items-center gap-1 text-xs text-gray-500">
              Radius
              <input
                type="number"
                min="0"
                max="48"
                value={ctaRadius}
                onChange={(event) =>
                  setCtaRadius(Number(event.target.value || 0))
                }
                className="h-7 w-14 rounded border border-gray-200 bg-white px-1 text-xs text-gray-700"
              />
            </label>
            <label className="inline-flex items-center gap-1 text-xs text-gray-500">
              Font
              <input
                type="number"
                min="10"
                max="24"
                value={ctaFontSize}
                onChange={(event) =>
                  setCtaFontSize(Number(event.target.value || 14))
                }
                className="h-7 w-14 rounded border border-gray-200 bg-white px-1 text-xs text-gray-700"
              />
            </label>
            <label className="inline-flex items-center gap-1 text-xs text-gray-500">
              Px
              <input
                type="number"
                min="8"
                max="40"
                value={ctaPaddingX}
                onChange={(event) =>
                  setCtaPaddingX(Number(event.target.value || 18))
                }
                className="h-7 w-14 rounded border border-gray-200 bg-white px-1 text-xs text-gray-700"
              />
            </label>
            <label className="inline-flex items-center gap-1 text-xs text-gray-500">
              Py
              <input
                type="number"
                min="6"
                max="28"
                value={ctaPaddingY}
                onChange={(event) =>
                  setCtaPaddingY(Number(event.target.value || 12))
                }
                className="h-7 w-14 rounded border border-gray-200 bg-white px-1 text-xs text-gray-700"
              />
            </label>
            <button
              type="button"
              onClick={() => applyCtaPreset("sm")}
              className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
            >
              Small
            </button>
            <button
              type="button"
              onClick={() => applyCtaPreset("md")}
              className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
            >
              Medium
            </button>
            <button
              type="button"
              onClick={() => applyCtaPreset("lg")}
              className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
            >
              Large
            </button>
            <button
              type="button"
              onClick={() => setCtaAlign("left")}
              className={`rounded-md px-2 py-1 text-xs ${
                ctaAlign === "left"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              L
            </button>
            <button
              type="button"
              onClick={() => setCtaAlign("center")}
              className={`rounded-md px-2 py-1 text-xs ${
                ctaAlign === "center"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              C
            </button>
            <button
              type="button"
              onClick={() => setCtaAlign("right")}
              className={`rounded-md px-2 py-1 text-xs ${
                ctaAlign === "right"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              R
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
        Click an image to resize by dragging its corners. Select a CTA button to
        edit size, colors, alignment, and link.
      </div>

      {editor.isEmpty && (
        <p className="pointer-events-none px-4 pb-3 text-sm text-gray-400">
          {placeholder}
        </p>
      )}
    </div>
  );
};

export default RichTextEditor;
