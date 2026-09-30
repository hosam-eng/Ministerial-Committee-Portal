export type SiteSettingsErrorCode =
  | "NOT_FOUND"
  | "INVALID_WORKFLOW_STATE"
  | "CONCURRENT_MODIFICATION"
  | "NO_ACTIVE_REVISION"
  | "ACTIVE_REVISION_EXISTS"
  | "ACTIVE_EDITING_EXISTS"
  | "REVISION_NOT_FOUND"
  | "RETURN_COMMENT_REQUIRED"
  | "UNPUBLISH_REASON_REQUIRED"
  | "SELF_APPROVAL_FORBIDDEN"
  | "INVALID_EMAIL"
  | "INVALID_PHONE"
  | "INVALID_SOCIAL_URL"
  | "DUPLICATE_SOCIAL_URL"
  | "BILINGUAL_REQUIRED"
  | "INVALID_DRAFT";

export class SiteSettingsError extends Error {
  readonly code: SiteSettingsErrorCode;

  constructor(code: SiteSettingsErrorCode) {
    super(code);
    this.name = "SiteSettingsError";
    this.code = code;
  }
}
