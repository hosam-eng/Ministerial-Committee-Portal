"use client";

export function ReferenceDataDeleteControl({
  canDelete,
  blockedReason,
  deleteLabel,
  cannotDeleteLabel,
  locale,
  sectionSlug,
  id,
  deleteAction,
}: {
  canDelete: boolean;
  blockedReason: string | null;
  deleteLabel: string;
  cannotDeleteLabel: string;
  locale: string;
  sectionSlug: string;
  id: string;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  const hintId = `delete-hint-${id}`;
  if (canDelete) {
    return (
      <form action={deleteAction} className="admin-refdata-governance-action">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="sectionSlug" value={sectionSlug} />
        <input type="hidden" name="id" value={id} />
        <button type="submit" className="ui-button ui-button-danger">
          {deleteLabel}
        </button>
      </form>
    );
  }
  return (
    <div className="admin-refdata-governance-action admin-refdata-delete-blocked">
      <button
        type="button"
        className="ui-button ui-button-danger"
        disabled
        aria-describedby={blockedReason ? hintId : undefined}
      >
        {cannotDeleteLabel}
      </button>
      {blockedReason && (
        <p id={hintId} className="admin-refdata-delete-hint" role="status">
          {blockedReason}
        </p>
      )}
    </div>
  );
}
