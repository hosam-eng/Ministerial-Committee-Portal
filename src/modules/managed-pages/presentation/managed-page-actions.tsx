import type { ReactNode } from "react";

export function ManagedPageActionBar({
  locale,
  pageId,
  workflowStatus,
  publicationStatus,
  canEdit,
  canReview,
  canPublish,
  action,
  messages,
}: {
  locale: string;
  pageId: string;
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
  };
}) {
  const hidden = (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="pageId" value={pageId} />
    </>
  );

  const blocks: ReactNode[] = [];

  if (workflowStatus === "PENDING_REVIEW" && canReview) {
    blocks.push(
      <div key="review" className="ui-action-group ui-action-group--align-end">
        <form action={action} className="news-inline-form">
          {hidden}
          <input type="hidden" name="operation" value="return" />
          <div className="admin-inline-field">
            <label htmlFor="return-comment">{messages.returnComment}</label>
            <textarea
              id="return-comment"
              className="ui-input"
              name="comment"
              required
              rows={2}
            />
          </div>
          <button className="ui-button ui-button-secondary" type="submit">
            {messages.return}
          </button>
        </form>
        <form action={action}>
          {hidden}
          <input type="hidden" name="operation" value="approve" />
          <button className="ui-button ui-button-primary" type="submit">
            {messages.approve}
          </button>
        </form>
      </div>,
    );
  }

  if (workflowStatus === "APPROVED" && canPublish) {
    blocks.push(
      <form key="publish" action={action}>
        {hidden}
        <input type="hidden" name="operation" value="publish" />
        <div className="ui-action-group">
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
        <div className="ui-action-group">
          <button className="ui-button ui-button-secondary" type="submit">
            {messages.edit}
          </button>
        </div>
      </form>,
    );
  }

  if (publicationStatus === "PUBLISHED" && canPublish) {
    blocks.push(
      <form key="unpublish" action={action} className="news-inline-form">
        {hidden}
        <input type="hidden" name="operation" value="unpublish" />
        <div className="admin-inline-field">
          <label htmlFor="unpublish-reason">{messages.unpublishReason}</label>
          <textarea
            id="unpublish-reason"
            className="ui-input"
            name="reason"
            required
            rows={2}
          />
        </div>
        <div className="ui-action-group">
          <button className="ui-button ui-button-danger" type="submit">
            {messages.unpublish}
          </button>
        </div>
      </form>,
    );
  }

  if (blocks.length === 0) return null;

  return <div className="admin-workflow-panel">{blocks}</div>;
}
