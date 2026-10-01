import type { ReactNode } from "react";

export function HomepageActionBar({
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
          <label className="ui-field" htmlFor="homepage-return-comment">
            <span>{messages.returnComment}</span>
            <textarea
              id="homepage-return-comment"
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

  if (publicationStatus === "PUBLISHED" && !workflowStatus && canEdit) {
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
      <form
        key="unpublish"
        action={action}
        className="admin-rail-form admin-rail-form--section"
      >
        {hidden}
        <input type="hidden" name="operation" value="unpublish" />
        <h3 className="admin-rail-subheading">{messages.unpublishSection}</h3>
        <label className="ui-field" htmlFor="homepage-unpublish-reason">
          <span>{messages.unpublishReason}</span>
          <textarea
            id="homepage-unpublish-reason"
            className="ui-input"
            name="reason"
            required
            rows={2}
          />
        </label>
        <div className="ui-action-group ui-action-group--stack">
          <button className="ui-button ui-button-secondary" type="submit">
            {messages.unpublish}
          </button>
        </div>
      </form>,
    );
  }

  if (!blocks.length) return null;
  return <div className="admin-rail-action-stack">{blocks}</div>;
}
