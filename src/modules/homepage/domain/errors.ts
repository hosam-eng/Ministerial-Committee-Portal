export type HomepageErrorCode =
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
  | "INVALID_DRAFT"
  | "INVALID_SECTION"
  | "INVALID_SYSTEM_ROUTE"
  | "INVALID_CONTENT_TARGET"
  | "INVALID_EXTERNAL_URL"
  | "INVALID_CTA"
  | "INVALID_NEWS_SELECTION"
  | "UNAVAILABLE_TARGET"
  | "BILINGUAL_REQUIRED";

export class HomepageError extends Error {
  readonly code: HomepageErrorCode;

  constructor(code: HomepageErrorCode) {
    super(code);
    this.name = "HomepageError";
    this.code = code;
  }
}
