import { ManagedPageError } from "../domain/errors";

export type WorkflowStatus =
  "EDITING" | "PENDING_REVIEW" | "APPROVED" | "RETURNED";

export function assertEditing(status: string) {
  if (status !== "EDITING")
    throw new ManagedPageError("INVALID_WORKFLOW_STATE");
}

export function assertPendingReview(status: string) {
  if (status !== "PENDING_REVIEW")
    throw new ManagedPageError("INVALID_WORKFLOW_STATE");
}

export function assertApproved(status: string) {
  if (status !== "APPROVED")
    throw new ManagedPageError("INVALID_WORKFLOW_STATE");
}

/**
 * Public visibility is an aggregate fact. Approval never implies it.
 * Callers must also require liveRevisionId.
 */
export function isPublishedAggregate(
  status: string,
  liveRevisionId: string | null,
): boolean {
  return status === "PUBLISHED" && liveRevisionId !== null;
}
