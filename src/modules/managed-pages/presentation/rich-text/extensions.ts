import Link from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";

const ManagedLink = Link.extend({
  addAttributes() {
    return {
      linkKind: {
        default: "external",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-link-kind") ?? "external",
        renderHTML: (attributes: { linkKind?: string | null }) => ({
          "data-link-kind": attributes.linkKind ?? "external",
        }),
      },
      targetRef: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-target-ref"),
        renderHTML: (attributes: { targetRef?: string | null }) =>
          attributes.targetRef
            ? { "data-target-ref": attributes.targetRef }
            : {},
      },
      href: {
        default: null,
      },
    };
  },
});

/** Editor and static renderer share this schema. It does not import @tiptap/react. */
export const richTextExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3, 4] },
    link: false,
    code: false,
    codeBlock: false,
    strike: false,
    underline: false,
    horizontalRule: false,
    hardBreak: false,
  }),
  ManagedLink.configure({
    openOnClick: false,
    autolink: false,
    linkOnPaste: false,
    protocols: ["https"],
    defaultProtocol: "https",
    HTMLAttributes: {},
    validate: (url: string) => url.startsWith("https://"),
  }),
];
