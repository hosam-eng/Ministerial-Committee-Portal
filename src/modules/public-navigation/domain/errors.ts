export type PublicNavigationErrorCode =
  | "NOT_FOUND"
  | "NO_ACTIVE_REVISION"
  | "ACTIVE_REVISION_EXISTS"
  | "ACTIVE_EDITING_EXISTS"
  | "REVISION_NOT_FOUND"
  | "INVALID_WORKFLOW_STATE"
  | "CONCURRENT_MODIFICATION"
  | "SELF_APPROVAL_FORBIDDEN"
  | "RETURN_COMMENT_REQUIRED"
  | "UNPUBLISH_REASON_REQUIRED"
  | "INVALID_LOCATION"
  | "INVALID_ITEM_TYPE"
  | "INVALID_PARENT"
  | "INVALID_HIERARCHY"
  | "MAX_DEPTH_EXCEEDED"
  | "MISSING_LABEL"
  | "INVALID_SYSTEM_ROUTE"
  | "INVALID_CONTENT_TARGET"
  | "INVALID_EXTERNAL_URL"
  | "UNAVAILABLE_TARGET"
  | "EMPTY_PUBLISH_TREE"
  | "DUPLICATE_ITEM_KEY"
  | "INVALID_ORDER";

export class PublicNavigationError extends Error {
  readonly code: PublicNavigationErrorCode;

  constructor(code: PublicNavigationErrorCode) {
    super(code);
    this.name = "PublicNavigationError";
    this.code = code;
  }
}
