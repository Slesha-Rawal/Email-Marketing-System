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
  Trash2,
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
      const imageSelected = editor.isActive("image");
      setHasSelectedImage(imageSelected);

      if (imageSelected) {
        const imageAttrs = editor.getAttributes("image");
        setImageAlign(imageAttrs.imageAlign || "center");
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
    if (!editor || !hasSelectedImage) {
      return;
    }

    const attrs = editor.getAttributes("image");
    if ((attrs.imageAlign || "center") === imageAlign) {
      return;
    }

    editor.chain().updateAttributes("image", { imageAlign }).run();
  }, [editor, hasSelectedImage, imageAlign]);

  const deleteSelectedImage = () => {
    if (!editor || !hasSelectedImage) {
      return;
    }

    editor.chain().focus().deleteSelection().run();
    setHasSelectedImage(false);
  };

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

      {hasSelectedImage && (
        <div className="border-t border-gray-100 bg-gray-50 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-600">
              Image Controls
            </span>
            <button
              type="button"
              onClick={() => setImageAlign("left")}
              className={`rounded-md px-2 py-1 text-xs ${
                imageAlign === "left"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Left
            </button>
            <button
              type="button"
              onClick={() => setImageAlign("center")}
              className={`rounded-md px-2 py-1 text-xs ${
                imageAlign === "center"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Center
            </button>
            <button
              type="button"
              onClick={() => setImageAlign("right")}
              className={`rounded-md px-2 py-1 text-xs ${
                imageAlign === "right"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Right
            </button>
            <button
              type="button"
              onClick={deleteSelectedImage}
              className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Image
            </button>
          </div>
        </div>
      )}

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
