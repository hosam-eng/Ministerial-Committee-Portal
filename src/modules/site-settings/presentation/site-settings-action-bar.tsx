import type { ReactNode } from "react";

export function SiteSettingsActionBar({
  locale,
  workflowStatus,
  publicationStatus,
  canEdit,
  canReview,
  canPublish,
  action,
  messages,
}: {
  locale: string;
  workflowStatus: string | null;
  publicationStatus: string;
  canEdit: boolean;
  canReview: boolean;
  canPublish: boolean;
  action: (formData: FormData) => void | Promise<void>;
  messages: {
    return: string;
    approve: string;
    publish: string;
    unpublish: string;
    edit: string;
    returnComment: string;
    unpublishReason: string;
    unpublishSection: string;
  };
}) {
  const hidden = <input type="hidden" name="locale" value={locale} />;
  const blocks: ReactNode[] = [];

  if (workflowStatus === "PENDING_REVIEW" && canReview) {
    blocks.push(
      <div key="review" className="admin-rail-action-stack">
        <form action={action} className="admin-rail-form">
          {hidden}
          <input type="hidden" name="operation" value="return" />
          <label className="ui-field" htmlFor="ss-return-comment">
            <span>{messages.returnComment}</span>
            <textarea
              id="ss-return-comment"
              className="ui-input"
              name="comment"
              required
              rows={2}
            />
          </label>
          <div className="ui-action-group ui-action-group--stack">
            <button className="ui-button ui-button-secondary" type="submit">
              {messages.return}
            </button>
          </div>
        </form>
        <form action={action}>
          {hidden}
          <input type="hidden" name="operation" value="approve" />
          <div className="ui-action-group ui-action-group--stack">
            <button className="ui-button ui-button-primary" type="submit">
              {messages.approve}
            </button>
          </div>
        </form>
      </div>,
    );
  }

  if (workflowStatus === "APPROVED" && canPublish) {
    blocks.push(
      <form key="publish" action={action}>
        {hidden}
        <input type="hidden" name="operation" value="publish" />
        <div className="ui-action-group ui-action-group--stack">
          <button className="ui-button ui-button-primary" type="submit">
            {messages.publish}
          </button>
        </div>
      </form>,
    );
  }

  if (!workflowStatus && canEdit && publicationStatus !== "NEVER_PUBLISHED") {
    blocks.push(
      <form key="edit" action={action}>
        {hidden}
        <input type="hidden" name="operation" value="edit" />
        <div className="ui-action-group ui-action-group--stack">
          <button className="ui-button ui-button-secondary" type="submit">
            {messages.edit}
          </button>
        </div>
      </form>,
    );
  }

  if (publicationStatus === "PUBLISHED" && canPublish) {
    blocks.push(
      <div key="unpublish" className="admin-rail-danger-section">
        <h4 className="admin-rail-danger-title">{messages.unpublishSection}</h4>
        <form action={action} className="admin-rail-form">
          {hidden}
          <input type="hidden" name="operation" value="unpublish" />
          <label className="ui-field" htmlFor="ss-unpublish-reason">
            <span>{messages.unpublishReason}</span>
            <textarea
              id="ss-unpublish-reason"
              className="ui-input"
              name="reason"
              required
              rows={2}
            />
          </label>
          <div className="ui-action-group ui-action-group--stack">
            <button className="ui-button ui-button-danger" type="submit">
              {messages.unpublish}
            </button>
          </div>
        </form>
      </div>,
    );
  }

  return blocks.length ? (
    <div className="admin-rail-action-stack">{blocks}</div>
  ) : null;
}
