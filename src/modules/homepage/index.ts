export { HomepageError } from "./domain/errors";
export {
  HOMEPAGE_SECTION_TYPES,
  MAX_MANUAL_NEWS_ITEMS,
  type HomepageSectionType,
  type HomepageNewsMode,
} from "./domain/sections";
export {
  emptyHomepageDraft,
  swapHomepageSectionPositions,
  validateHomepageDraft,
  type HomepageDraft,
  type HomepageSectionDraft,
  type HomepageHeroDraft,
  type HomepageNewsDraft,
} from "./domain/draft";
export {
  addManualNewsId,
  canAddManualNews,
  filterAvailableManualNewsToAdd,
  moveManualNewsId,
  removeManualNewsId,
  resolveSelectedManualNewsRows,
  type ManualNewsPickerTarget,
  type SelectedManualNewsRow,
} from "./domain/manual-news";
export {
  coalesceHomepageHeroCtaDraft,
  patchHomepageHeroCtaForTargetTypeChange,
  validateHomepageHeroCta,
} from "./domain/hero-cta";
export {
  collectHomepageCompletenessIssues,
  type HomepageCompletenessIssueKey,
} from "./domain/completeness";
export type {
  PublicHomepage,
  PublicHomepageHero,
  PublicHomepageNews,
  PublicHomepageNewsItem,
  PublicHomepageSection,
} from "./domain/public-view";
export {
  approveHomepage,
  getEditorialHomepage,
  loadRevisionDraft,
  publishHomepage,
  restoreHomepageRevision,
  resolveHomepageDraftToPublic,
  resolveHomepagePreview,
  describeHomepageDraftCompleteness,
  resolveLivePublicHomepage,
  returnHomepage,
  saveHomepageDraft,
  startEditingHomepage,
  submitHomepage,
  unpublishHomepage,
  type EditorialHomepage,
  type HomepagePreview,
} from "./infrastructure/homepage-service";
export {
  inspectHomepageNewsReferenceUsage,
  type HomepageNewsReferenceUsage,
} from "./infrastructure/news-dependency";
export {
  HomepageEditor,
  type HomepageEditorState,
} from "./presentation/homepage-editor";
export { HomepageActionBar } from "./presentation/homepage-action-bar";
export {
  HomepagePublicContent,
  type HomepagePublicMessages,
} from "./presentation/homepage-public-content";
