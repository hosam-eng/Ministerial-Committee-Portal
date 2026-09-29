/**
 * Client entry for the backoffice editor.
 * Kept off the main module contract so public routes do not load TipTap.
 */
export {
  ManagedPageEditor,
  type ManagedPageEditorAction,
  type ManagedPageEditorMessages,
  type ManagedPageEditorState,
} from "./presentation/managed-page-editor";
