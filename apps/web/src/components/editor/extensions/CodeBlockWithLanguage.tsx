import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";

const CODE_LANGUAGE_OPTIONS = [
  { value: "", label: "Auto" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "rust", label: "Rust" },
  { value: "bash", label: "Bash" },
  { value: "json", label: "JSON" },
  { value: "markdown", label: "Markdown" },
  { value: "css", label: "CSS" },
] as const;

function CodeBlockNodeView({ node, updateAttributes }: NodeViewProps) {
  const selectedLanguage =
    typeof node.attrs.language === "string" ? node.attrs.language : "";

  return (
    <NodeViewWrapper as="div" className="relative my-4">
      <div className="absolute right-3 top-3 z-10" contentEditable={false}>
        <select
          aria-label="Code language"
          value={selectedLanguage}
          onChange={(event) => {
            const language = event.target.value;
            updateAttributes({ language: language || null });
          }}
          className="rounded-md border border-[#3f3e3a] bg-[#292825] px-2 py-1 text-xs font-medium text-[#f6f5f0] outline-none"
        >
          {CODE_LANGUAGE_OPTIONS.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <pre className="overflow-x-auto rounded-xl border border-[#3f3e3a] bg-[#1f1f1d] px-4 pb-4 pt-12 font-mono text-sm leading-6 text-[#f8f4e8] shadow-inner">
        <code className="block whitespace-pre">
          <NodeViewContent />
        </code>
      </pre>
    </NodeViewWrapper>
  );
}

export const CodeBlockLowlightWithLanguage = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockNodeView);
  },
});
