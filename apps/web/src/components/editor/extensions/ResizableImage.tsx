import Image from "@tiptap/extension-image";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { useCallback, useRef, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, RotateCcw } from "lucide-react";

type ImageAlign = "left" | "center" | "right";

const MIN_IMAGE_WIDTH_PX = 96;

function alignToJustifyClass(align: ImageAlign): string {
  if (align === "left") return "justify-start";
  if (align === "right") return "justify-end";
  return "justify-center";
}

function ImageAlignButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-6 w-6 items-center justify-center rounded transition ${
        active ? "bg-accent-light text-accent" : "text-text-secondary hover:bg-surface hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

function ResizableImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const [isDragging, setIsDragging] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragStartRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const align: ImageAlign =
    node.attrs.align === "left" || node.attrs.align === "right" ? node.attrs.align : "center";
  const width = typeof node.attrs.width === "string" ? node.attrs.width : null;

  const startResize = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const imageElement = imgRef.current;
      if (!imageElement) return;

      const startWidth = imageElement.getBoundingClientRect().width;
      dragStartRef.current = { startX: event.clientX, startWidth };
      setIsDragging(true);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!dragStartRef.current || !imgRef.current) return;

        const parentWidth =
          imgRef.current.parentElement?.parentElement?.getBoundingClientRect().width ?? 800;
        const delta = moveEvent.clientX - dragStartRef.current.startX;
        const nextWidth = Math.max(
          MIN_IMAGE_WIDTH_PX,
          Math.min(dragStartRef.current.startWidth + delta, parentWidth)
        );

        imgRef.current.style.width = `${Math.round(nextWidth)}px`;
      };

      const handleMouseUp = () => {
        if (imgRef.current) {
          updateAttributes({ width: imgRef.current.style.width });
        }

        dragStartRef.current = null;
        setIsDragging(false);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [updateAttributes]
  );

  return (
    <NodeViewWrapper
      as="div"
      className={`relative my-4 flex ${alignToJustifyClass(align)}`}
      data-drag-handle
    >
      <div className="group relative inline-block max-w-full" style={width ? { width } : undefined}>
        <img
          ref={imgRef}
          src={typeof node.attrs.src === "string" ? node.attrs.src : ""}
          alt={typeof node.attrs.alt === "string" ? node.attrs.alt : ""}
          title={typeof node.attrs.title === "string" ? node.attrs.title : undefined}
          draggable={false}
          style={{ width: width ?? "100%", display: "block" }}
          className={`max-w-full rounded-lg transition ${
            selected ? "outline outline-2 outline-offset-2 outline-accent" : ""
          }`}
        />

        {selected && (
          <div
            contentEditable={false}
            className="absolute -top-10 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-bg-elevated px-1.5 py-1 shadow-lg"
          >
            <ImageAlignButton
              active={align === "left"}
              onClick={() => updateAttributes({ align: "left" })}
              label="Align image left"
            >
              <AlignLeft size={13} />
            </ImageAlignButton>
            <ImageAlignButton
              active={align === "center"}
              onClick={() => updateAttributes({ align: "center" })}
              label="Align image center"
            >
              <AlignCenter size={13} />
            </ImageAlignButton>
            <ImageAlignButton
              active={align === "right"}
              onClick={() => updateAttributes({ align: "right" })}
              label="Align image right"
            >
              <AlignRight size={13} />
            </ImageAlignButton>
            <div className="mx-0.5 h-4 w-px bg-border" />
            <ImageAlignButton
              active={false}
              onClick={() => updateAttributes({ width: null })}
              label="Reset image size"
            >
              <RotateCcw size={13} />
            </ImageAlignButton>
          </div>
        )}

        {selected && (
          <div
            onMouseDown={startResize}
            contentEditable={false}
            title="Drag to resize"
            className={`absolute bottom-1 right-1 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border border-white bg-accent shadow ${
              isDragging ? "scale-110" : ""
            }`}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}

/**
 * Drop-in replacement for `@tiptap/extension-image` that renders a React
 * node view with drag-to-resize (bottom-right handle) and left/center/right
 * alignment controls shown when the image is selected. Width/alignment
 * round-trip through HTML as `style="width:...px"` + `data-align="..."` so
 * they survive save/reload.
 */
export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => element.style.width || null,
        renderHTML: () => ({}),
      },
      align: {
        default: "center",
        parseHTML: (element) => element.getAttribute("data-align") || "center",
        renderHTML: (attributes) => {
          const widthPart = attributes.width ? `width: ${attributes.width};` : "";
          const alignStyles: Record<string, string> = {
            left: "display:block; margin-left:0; margin-right:auto;",
            right: "display:block; margin-left:auto; margin-right:0;",
            center: "display:block; margin-left:auto; margin-right:auto;",
          };
          const alignPart = alignStyles[attributes.align as string] ?? alignStyles.center;

          return {
            "data-align": attributes.align,
            style: `${widthPart} ${alignPart}`.trim(),
          };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});
