import React, { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Node, mergeAttributes } from "@tiptap/core";
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
  MousePointer2,
  RectangleHorizontal,
  Redo2,
  Undo2,
} from "lucide-react";
import api from "../lib/api.js";

const ToolbarButton = ({
  onClick,
  isActive = false,
  title,
  children,
  disabled = false,
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    disabled={disabled}
    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-700 transition-colors ${
      disabled
        ? "cursor-not-allowed text-gray-300"
        : isActive
          ? "bg-gray-900 text-white"
          : "hover:bg-gray-100"
    }`}
  >
    {children}
  </button>
);

const ResizableImage = ImageResize.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      imageAlign: {
        default: "center",
        parseHTML: (element) =>
          element.getAttribute("data-image-align") || "center",
        renderHTML: (attributes) => ({
          "data-image-align": attributes.imageAlign || "center",
        }),
      },
    };
  },
});

const ButtonNode = Node.create({
  name: "buttonNode",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      text: {
        default: "Learn More",
      },
      href: {
        default: "https://",
      },
      backgroundColor: {
        default: "#4E9A43", // green
      },
      textColor: {
        default: "#ffffff",
      },
      textAlign: {
        default: "center",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="button-container"]',
        getAttrs: (element) => {
          const anchor = element.querySelector("a");
          return {
            text: anchor?.textContent || "Learn More",
            href: anchor?.getAttribute("href") || "https://",
            backgroundColor: anchor?.style.backgroundColor || "#4E9A43",
            textColor: anchor?.style.color || "#ffffff",
            textAlign: element.style.textAlign || "center",
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { textAlign, backgroundColor, textColor, text, href } =
      HTMLAttributes;
    return [
      "div",
      {
        "data-type": "button-container",
        style: `text-align: ${textAlign}; margin: 20px 0;`,
      },
      [
        "a",
        {
          href,
          "data-type": "button",
          target: "_blank",
          rel: "noopener noreferrer",
          style: `background-color: ${backgroundColor}; color: ${textColor}; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: 600; font-family: sans-serif; cursor: pointer; border: none;`,
        },
        text,
      ],
    ];
  },

  addCommands() {
    return {
      setButton:
        (options) =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs: options || {},
            })
            .run();
        },
      updateButton:
        (options) =>
        ({ chain }) => {
          return chain().updateAttributes(this.name, options).run();
        },
    };
  },
});

const RichTextEditor = ({ value, onChange, placeholder = "Write here..." }) => {
  const [hasSelectedImage, setHasSelectedImage] = useState(false);
  const [imageAlign, setImageAlign] = useState("center");
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState("https://");
  const [hasSelectedButton, setHasSelectedButton] = useState(false);
  const [buttonProps, setButtonProps] = useState({
    text: "Learn More",
    href: "https://",
    backgroundColor: "#4E9A43",
    textColor: "#ffffff",
    textAlign: "center",
  });
  const [textColor, setTextColor] = useState("#111827");
  const imageInputRef = useRef(null);
  const textColorInputRef = useRef(null);
  const btnBgColorInputRef = useRef(null);
  const btnTextColorInputRef = useRef(null);

  const getSelectedNodeTypeName = () =>
    editor?.state?.selection?.node?.type?.name || "";

  const inferAlignFromContainerStyle = (containerStyle = "") => {
    const normalized = containerStyle.toLowerCase().replace(/\s+/g, " ");
    if (normalized.includes("margin: 0 0 0 auto")) {
      return "right";
    }
    if (normalized.includes("margin: 0 auto 0 0")) {
      return "left";
    }
    if (normalized.includes("margin: 0 auto")) {
      return "center";
    }
    return "center";
  };

  const applyImageResizeAlignment = (alignment) => {
    if (!editor) {
      return false;
    }

    const attrs = editor.getAttributes("imageResize") || {};
    const existingContainerStyle = attrs.containerStyle || "";
    const cleanedContainerStyle = existingContainerStyle
      .replace(/margin\s*:[^;]+;?/gi, "")
      .replace(/float\s*:[^;]+;?/gi, "")
      .replace(/padding-left\s*:[^;]+;?/gi, "")
      .replace(/padding-right\s*:[^;]+;?/gi, "")
      .trim();

    const marginRule =
      alignment === "left"
        ? "margin: 0 auto 0 0;"
        : alignment === "right"
          ? "margin: 0 0 0 auto;"
          : "margin: 0 auto;";

    const nextContainerStyle = `${cleanedContainerStyle}${
      cleanedContainerStyle && !cleanedContainerStyle.endsWith(";") ? ";" : ""
    } ${marginRule}`.trim();

    const nextWrapperStyle = "display: flex;";

    return editor
      .chain()
      .focus()
      .updateAttributes("imageResize", {
        imageAlign: alignment,
        containerStyle: nextContainerStyle,
        wrapperStyle: nextWrapperStyle,
      })
      .run();
  };

  const applyImageNodeAlignment = (alignment) => {
    if (!editor) {
      return false;
    }

    const attrs = editor.getAttributes("image") || {};
    const existingStyle = attrs.style || "";
    const cleanedStyle = existingStyle
      .replace(/margin-left\s*:[^;]+;?/gi, "")
      .replace(/margin-right\s*:[^;]+;?/gi, "")
      .replace(/display\s*:[^;]+;?/gi, "")
      .replace(/float\s*:[^;]+;?/gi, "")
      .trim();

    const alignStyle =
      alignment === "left"
        ? "display:block;margin-left:0;margin-right:auto;"
        : alignment === "right"
          ? "display:block;margin-left:auto;margin-right:0;"
          : "display:block;margin-left:auto;margin-right:auto;";

    const nextStyle = `${cleanedStyle}${
      cleanedStyle && !cleanedStyle.endsWith(";") ? ";" : ""
    }${alignStyle}`;

    return editor
      .chain()
      .focus()
      .updateAttributes("image", {
        imageAlign: alignment,
        style: nextStyle,
      })
      .run();
  };

  const isImageNodeSelected = () => {
    const selectedNodeName = getSelectedNodeTypeName();
    return (
      selectedNodeName === "image" ||
      selectedNodeName === "resizableImage" ||
      selectedNodeName === "imageResize" ||
      editor?.isActive("image") ||
      editor?.isActive("imageResize")
    );
  };

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
        types: ["heading", "paragraph", "buttonNode"],
      }),
      ResizableImage.configure({
        inline: false,
        minWidth: 80,
        maxWidth: 900,
      }),
      ButtonNode,
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "tiptap prose prose-sm max-w-[600px] mx-auto min-h-40 px-4 py-3 focus:outline-none",
      },
      handleKeyDown: (view, event) => {
        if (!view.hasFocus()) {
          return false;
        }

        if (event.key !== "Backspace" && event.key !== "Delete") {
          return false;
        }

        const { state } = view;
        const { selection } = state;
        const selectedNode = selection?.node;

        if (
          selectedNode?.type?.name === "image" ||
          selectedNode?.type?.name === "imageResize" ||
          selectedNode?.type?.name === "buttonNode"
        ) {
          event.preventDefault();
          view.dispatch(state.tr.deleteSelection());
          return true;
        }

        return false;
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
      const imageSelected =
        editor.isActive("imageResize") || editor.isActive("image");
      setHasSelectedImage(imageSelected);

      if (imageSelected) {
        const imageAttrs = editor.isActive("imageResize")
          ? editor.getAttributes("imageResize")
          : editor.getAttributes("image");
        setImageAlign(
          imageAttrs.imageAlign ||
            inferAlignFromContainerStyle(imageAttrs.containerStyle),
        );
      }

      const currentColor = editor.getAttributes("textStyle").color;
      if (currentColor) {
        setTextColor(currentColor);
      }

      const buttonSelected = editor.isActive("buttonNode");
      setHasSelectedButton(buttonSelected);

      if (buttonSelected) {
        const attrs = editor.getAttributes("buttonNode");
        setButtonProps({
          text: attrs.text ?? "",
          href: attrs.href ?? "",
          backgroundColor: attrs.backgroundColor ?? "#4E9A43",
          textColor: attrs.textColor ?? "#ffffff",
          textAlign: attrs.textAlign ?? "center",
        });
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

  // Handle button property updates
  useEffect(() => {
    if (!editor || !hasSelectedButton) {
      return;
    }

    const currentAttrs = editor.getAttributes("buttonNode");
    const hasChanged =
      currentAttrs.text !== buttonProps.text ||
      currentAttrs.href !== buttonProps.href ||
      currentAttrs.backgroundColor !== buttonProps.backgroundColor ||
      currentAttrs.textColor !== buttonProps.textColor ||
      currentAttrs.textAlign !== buttonProps.textAlign;

    if (hasChanged) {
      editor.chain().updateAttributes("buttonNode", buttonProps).run();
    }
  }, [editor, hasSelectedButton, buttonProps]);

  const handlePickImageFromDesktop = () => {
    imageInputRef.current?.click();
  };

  const handleImageFileChange = async (event) => {
    if (!editor) {
      return;
    }

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await api.post("/templates/upload-image", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      editor
        .chain()
        .focus()
        .setImage({ src: response.data.url, imageAlign: "center" })
        .run();
    } catch (error) {
      window.alert(
        error.response?.data?.message || "Failed to upload image from desktop",
      );
    } finally {
      event.target.value = "";
    }
  };

  const setLinkForSelection = () => {
    if (!editor) {
      return;
    }

    const previousUrl = editor.getAttributes("link").href || "https://";
    setLinkUrl(previousUrl);
    setShowLinkModal(true);
  };

  const isAlignmentActive = (alignment) => {
    if (hasSelectedImage) {
      return imageAlign === alignment;
    }

    return editor?.isActive({ textAlign: alignment });
  };

  const applyAlignment = (alignment) => {
    if (!editor) {
      return;
    }

    if (hasSelectedImage || isImageNodeSelected()) {
      setImageAlign(alignment);
      applyImageResizeAlignment(alignment);
      applyImageNodeAlignment(alignment);
      return;
    }

    editor.chain().focus().setTextAlign(alignment).run();
  };

  const applyLinkFromModal = () => {
    if (!editor) {
      return;
    }

    const nextUrl = linkUrl.trim();

    if (!nextUrl) {
      editor.chain().focus().unsetLink().run();
      setShowLinkModal(false);
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: nextUrl })
      .run();

    setShowLinkModal(false);
  };

  const removeLinkFromModal = () => {
    if (!editor) {
      return;
    }

    editor.chain().focus().unsetLink().run();
    setShowLinkModal(false);
  };

  useEffect(() => {
    if (!editor || !hasSelectedImage) {
      return;
    }

    const attrs = editor.isActive("imageResize")
      ? editor.getAttributes("imageResize")
      : editor.getAttributes("image");
    const currentAlign =
      attrs.imageAlign || inferAlignFromContainerStyle(attrs.containerStyle);
    if (currentAlign === imageAlign) {
      return;
    }

    applyImageResizeAlignment(imageAlign);
    applyImageNodeAlignment(imageAlign);
  }, [editor, hasSelectedImage, imageAlign]);

  const insertButton = () => {
    if (!editor) {
      return;
    }
    editor.chain().focus().setButton().run();
  };

  const deleteSelectedButton = () => {
    if (!editor || !hasSelectedButton) {
      return;
    }

    editor.chain().focus().deleteSelection().run();
    setHasSelectedButton(false);
  };

  if (!editor) {
    return (
      <div className="min-h-40 bg-white px-4 py-3 text-sm text-gray-500">
        Loading editor...
      </div>
    );
  }

  return (
    <div className="bg-white">
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">
              Insert Link
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Add or update the hyperlink for the selected text.
            </p>

            <label className="mt-4 block text-xs font-medium text-gray-700">
              URL
            </label>
            <input
              type="url"
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="https://example.com"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-indigo-400 focus:outline-none"
              autoFocus
            />

            <div className="mt-4 flex items-center justify-end gap-2">
              {editor.isActive("link") && (
                <button
                  type="button"
                  onClick={removeLinkFromModal}
                  className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Remove
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyLinkFromModal}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700"
              >
                Apply Link
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-nowrap items-center gap-1 border-b border-gray-200 bg-white px-2 py-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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
        <ToolbarButton
          title="Text color"
          onClick={() => textColorInputRef.current?.click()}
        >
          <span
            className="text-sm font-semibold underline decoration-2"
            style={{ color: textColor }}
          >
            A
          </span>
        </ToolbarButton>
        <input
          ref={textColorInputRef}
          type="color"
          value={textColor}
          onChange={(event) => {
            const next = event.target.value;
            setTextColor(next);
            editor.chain().focus().setColor(next).run();
          }}
          className="absolute h-0 w-0 opacity-0 pointer-events-none"
          tabIndex={-1}
          aria-hidden="true"
        />
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
          isActive={isAlignmentActive("left")}
          onClick={() => applyAlignment("left")}
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Align center"
          isActive={isAlignmentActive("center")}
          onClick={() => applyAlignment("center")}
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Align right"
          isActive={isAlignmentActive("right")}
          onClick={() => applyAlignment("right")}
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
        <ToolbarButton
          title="Insert image from desktop"
          onClick={handlePickImageFromDesktop}
        >
          <ImagePlus className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Add Button" onClick={insertButton}>
          <RectangleHorizontal className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageFileChange}
        className="hidden"
      />

      {hasSelectedButton && (
        <div className="border-t border-gray-100 bg-gray-50 px-3 py-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Button Settings
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">
                  Text
                </label>
                <input
                  type="text"
                  value={buttonProps.text}
                  onChange={(e) =>
                    setButtonProps((prev) => ({
                      ...prev,
                      text: e.target.value,
                    }))
                  }
                  className="rounded border border-gray-300 px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500"
                  placeholder="Button text"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">
                  Link
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={buttonProps.href}
                    onChange={(e) =>
                      setButtonProps((prev) => ({
                        ...prev,
                        href: e.target.value,
                      }))
                    }
                    className="rounded border border-gray-300 px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500 w-40"
                    placeholder="https://"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">
                  Colors
                </label>
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <button
                      title="Background Color"
                      onClick={() => btnBgColorInputRef.current?.click()}
                      className="h-7 w-7 rounded border border-gray-300 shadow-sm"
                      style={{ backgroundColor: buttonProps.backgroundColor }}
                    />
                    <span className="text-[10px] font-semibold text-gray-500 uppercase">
                      BG
                    </span>
                  </div>
                  <input
                    ref={btnBgColorInputRef}
                    type="color"
                    value={buttonProps.backgroundColor}
                    onChange={(e) =>
                      setButtonProps((prev) => ({
                        ...prev,
                        backgroundColor: e.target.value,
                      }))
                    }
                    className="absolute h-0 w-0 opacity-0 pointer-events-none"
                  />

                  <div className="flex flex-col items-center gap-1">
                    <button
                      title="Text Color"
                      onClick={() => btnTextColorInputRef.current?.click()}
                      className="flex h-7 w-7 items-center justify-center rounded border border-gray-300 bg-gray-900 shadow-sm"
                    >
                      <span
                        className="text-xs font-bold"
                        style={{ color: buttonProps.textColor }}
                      >
                        A
                      </span>
                    </button>
                    <span className="text-[10px] font-semibold text-gray-500 uppercase">
                      Text
                    </span>
                  </div>
                  <input
                    ref={btnTextColorInputRef}
                    type="color"
                    value={buttonProps.textColor}
                    onChange={(e) =>
                      setButtonProps((prev) => ({
                        ...prev,
                        textColor: e.target.value,
                      }))
                    }
                    className="absolute h-0 w-0 opacity-0 pointer-events-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {editor.isEmpty && (
        <p className="pointer-events-none px-4 pb-3 text-sm text-gray-400">
          {placeholder}
        </p>
      )}
    </div>
  );
};

export default RichTextEditor;
