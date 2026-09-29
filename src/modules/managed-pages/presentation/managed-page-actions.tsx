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
  return (
    <div className="news-actions">
      {workflowStatus === "PENDING_REVIEW" && canReview && (
        <>
          <form action={action} className="news-inline-form">
            {hidden}
            <input type="hidden" name="operation" value="return" />
            <label htmlFor="return-comment">{messages.returnComment}</label>
            <textarea id="return-comment" name="comment" required rows={2} />
            <button className="news-button" type="submit">
              {messages.return}
            </button>
          </form>
          <form action={action}>
            {hidden}
            <input type="hidden" name="operation" value="approve" />
            <button className="news-button news-primary" type="submit">
              {messages.approve}
            </button>
          </form>
        </>
      )}
      {workflowStatus === "APPROVED" && canPublish && (
        <form action={action}>
          {hidden}
          <input type="hidden" name="operation" value="publish" />
          <button className="news-button news-primary" type="submit">
            {messages.publish}
          </button>
        </form>
      )}
      {!workflowStatus &&
        canEdit &&
        publicationStatus !== "NEVER_PUBLISHED" && (
          <form action={action}>
            {hidden}
            <input type="hidden" name="operation" value="edit" />
            <button className="news-button" type="submit">
              {messages.edit}
            </button>
          </form>
        )}
      {publicationStatus === "PUBLISHED" && canPublish && (
        <form action={action} className="news-inline-form">
          {hidden}
          <input type="hidden" name="operation" value="unpublish" />
          <label htmlFor="unpublish-reason">{messages.unpublishReason}</label>
          <textarea id="unpublish-reason" name="reason" required rows={2} />
          <button className="news-button news-danger" type="submit">
            {messages.unpublish}
          </button>
        </form>
      )}
    </div>
  );
}
