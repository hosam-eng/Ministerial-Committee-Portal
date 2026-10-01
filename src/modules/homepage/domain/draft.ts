import { HomepageError } from "./errors";
import { validateHomepageHeroCta, type HomepageHeroCtaDraft } from "./hero-cta";
import {
  HOMEPAGE_SECTION_TYPES,
  MAX_MANUAL_NEWS_ITEMS,
  type HomepageNewsMode,
  type HomepageSectionType,
} from "./sections";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type HomepageLocaleFields = {
  ar: Record<string, string>;
  en: Record<string, string>;
};

export type HomepageHeroTranslationDraft = {
  title: string;
  supportingText: string;
  ctaLabel: string;
};

export type HomepageHeroDraft = HomepageHeroCtaDraft & {
  translations: {
    ar: HomepageHeroTranslationDraft;
    en: HomepageHeroTranslationDraft;
  };
};

export type HomepageNewsTranslationDraft = {
  sectionHeading: string;
};

export type HomepageNewsDraft = {
  mode: HomepageNewsMode;
  manualNewsIds: string[];
  translations: {
    ar: HomepageNewsTranslationDraft;
    en: HomepageNewsTranslationDraft;
  };
};

export type HomepageSectionDraft = {
  sectionType: HomepageSectionType;
  position: number;
  enabled: boolean;
  hero: HomepageHeroDraft | null;
  news: HomepageNewsDraft | null;
};

export type HomepageDraft = {
  sections: HomepageSectionDraft[];
};

function emptyHeroTranslations(): HomepageHeroDraft["translations"] {
  return {
    ar: { title: "", supportingText: "", ctaLabel: "" },
    en: { title: "", supportingText: "", ctaLabel: "" },
  };
}

function emptyNewsTranslations(): HomepageNewsDraft["translations"] {
  return {
    ar: { sectionHeading: "" },
    en: { sectionHeading: "" },
  };
}

export function emptyHomepageHeroDraft(): HomepageHeroDraft {
  return {
    ctaEnabled: false,
    ctaTargetType: "",
    systemRouteKey: "",
    contentTargetKind: "",
    contentTargetId: "",
    externalUrl: "",
    translations: emptyHeroTranslations(),
  };
}

export function emptyHomepageNewsDraft(): HomepageNewsDraft {
  return {
    mode: "AUTOMATIC",
    manualNewsIds: [],
    translations: emptyNewsTranslations(),
  };
}

export function emptyHomepageDraft(): HomepageDraft {
  return validateHomepageDraft({
    sections: [
      {
        sectionType: "HERO",
        position: 0,
        enabled: true,
        hero: emptyHomepageHeroDraft(),
        news: null,
      },
      {
        sectionType: "NEWS",
        position: 1,
        enabled: true,
        hero: null,
        news: emptyHomepageNewsDraft(),
      },
    ],
  });
}

function parseHeroTranslations(
  value: unknown,
): HomepageHeroDraft["translations"] {
  const base = emptyHeroTranslations();
  if (!value || typeof value !== "object") return base;
  const record = value as Record<string, unknown>;
  for (const locale of ["ar", "en"] as const) {
    const row = record[locale];
    if (!row || typeof row !== "object") continue;
    const fields = row as Record<string, unknown>;
    base[locale] = {
      title: typeof fields.title === "string" ? fields.title : "",
      supportingText:
        typeof fields.supportingText === "string" ? fields.supportingText : "",
      ctaLabel: typeof fields.ctaLabel === "string" ? fields.ctaLabel : "",
    };
  }
  return base;
}

function parseNewsTranslations(
  value: unknown,
): HomepageNewsDraft["translations"] {
  const base = emptyNewsTranslations();
  if (!value || typeof value !== "object") return base;
  const record = value as Record<string, unknown>;
  for (const locale of ["ar", "en"] as const) {
    const row = record[locale];
    if (!row || typeof row !== "object") continue;
    const fields = row as Record<string, unknown>;
    base[locale] = {
      sectionHeading:
        typeof fields.sectionHeading === "string" ? fields.sectionHeading : "",
    };
  }
  return base;
}

function parseManualNewsIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const id = entry.trim();
    if (!UUID.test(id)) continue;
    if (!ids.includes(id)) ids.push(id);
    if (ids.length >= MAX_MANUAL_NEWS_ITEMS) break;
  }
  return ids;
}

function parseSection(row: unknown): HomepageSectionDraft | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const sectionType =
    record.sectionType === "HERO" || record.sectionType === "NEWS"
      ? record.sectionType
      : null;
  if (!sectionType) return null;
  const position = Number(record.position);
  if (!Number.isInteger(position) || position < 0) return null;
  const enabled = record.enabled !== false;
  const heroRaw = record.hero;
  const newsRaw = record.news;
  if (sectionType === "HERO") {
    if (!heroRaw || typeof heroRaw !== "object") return null;
    const heroRecord = heroRaw as Record<string, unknown>;
    return {
      sectionType,
      position,
      enabled,
      hero: {
        ctaEnabled: heroRecord.ctaEnabled === true,
        ctaTargetType:
          heroRecord.ctaTargetType === "SYSTEM_ROUTE" ||
          heroRecord.ctaTargetType === "CONTENT_ROUTE" ||
          heroRecord.ctaTargetType === "EXTERNAL_LINK"
            ? heroRecord.ctaTargetType
            : "",
        systemRouteKey:
          typeof heroRecord.systemRouteKey === "string"
            ? heroRecord.systemRouteKey
            : "",
        contentTargetKind:
          heroRecord.contentTargetKind === "MANAGED_PAGE" ? "MANAGED_PAGE" : "",
        contentTargetId:
          typeof heroRecord.contentTargetId === "string"
            ? heroRecord.contentTargetId
            : "",
        externalUrl:
          typeof heroRecord.externalUrl === "string"
            ? heroRecord.externalUrl
            : "",
        translations: parseHeroTranslations(heroRecord.translations),
      },
      news: null,
    };
  }
  if (!newsRaw || typeof newsRaw !== "object") return null;
  const newsRecord = newsRaw as Record<string, unknown>;
  const mode =
    newsRecord.mode === "MANUAL" ? "MANUAL" : ("AUTOMATIC" as HomepageNewsMode);
  return {
    sectionType,
    position,
    enabled,
    hero: null,
    news: {
      mode,
      manualNewsIds: parseManualNewsIds(newsRecord.manualNewsIds),
      translations: parseNewsTranslations(newsRecord.translations),
    },
  };
}

function validateSectionShape(section: HomepageSectionDraft, strict: boolean) {
  if (section.sectionType === "HERO") {
    if (!section.hero) throw new HomepageError("INVALID_SECTION");
    const hero = validateHomepageHeroCta(section.hero, strict);
    section.hero = { ...hero, translations: section.hero.translations };
    if (strict && section.enabled) {
      if (
        !section.hero.translations.ar.title.trim() ||
        !section.hero.translations.en.title.trim()
      ) {
        throw new HomepageError("BILINGUAL_REQUIRED");
      }
      if (section.hero.ctaEnabled) {
        if (
          !section.hero.translations.ar.ctaLabel.trim() ||
          !section.hero.translations.en.ctaLabel.trim()
        ) {
          throw new HomepageError("BILINGUAL_REQUIRED");
        }
        validateHomepageHeroCta(section.hero, true);
      }
    }
    return;
  }
  if (!section.news) throw new HomepageError("INVALID_SECTION");
  if (section.news.mode === "AUTOMATIC") {
    section.news.manualNewsIds = [];
  } else if (section.news.manualNewsIds.length > MAX_MANUAL_NEWS_ITEMS) {
    throw new HomepageError("INVALID_NEWS_SELECTION");
  }
  if (strict && section.enabled) {
    if (
      !section.news.translations.ar.sectionHeading.trim() ||
      !section.news.translations.en.sectionHeading.trim()
    ) {
      throw new HomepageError("BILINGUAL_REQUIRED");
    }
    if (section.news.mode === "MANUAL" && !section.news.manualNewsIds.length) {
      throw new HomepageError("INVALID_NEWS_SELECTION");
    }
  }
}

export function validateHomepageDraft(
  input: unknown,
  strict = false,
): HomepageDraft {
  if (!input || typeof input !== "object") {
    throw new HomepageError("INVALID_DRAFT");
  }
  const record = input as Record<string, unknown>;
  if (!Array.isArray(record.sections)) {
    throw new HomepageError("INVALID_DRAFT");
  }
  const sections: HomepageSectionDraft[] = [];
  for (const row of record.sections) {
    const parsed = parseSection(row);
    if (!parsed) throw new HomepageError("INVALID_DRAFT");
    sections.push(parsed);
  }
  if (sections.length !== HOMEPAGE_SECTION_TYPES.length) {
    throw new HomepageError("INVALID_DRAFT");
  }
  const types = new Set(sections.map((section) => section.sectionType));
  if (types.size !== HOMEPAGE_SECTION_TYPES.length) {
    throw new HomepageError("INVALID_DRAFT");
  }
  const positions = sections
    .map((section) => section.position)
    .sort((a, b) => a - b);
  if (
    positions.some((value, index) => value !== index) ||
    new Set(positions).size !== sections.length
  ) {
    throw new HomepageError("INVALID_DRAFT");
  }
  for (const section of sections) {
    validateSectionShape(section, strict);
  }
  sections.sort((a, b) => a.position - b.position);
  return { sections };
}

export function swapHomepageSectionPositions(
  draft: HomepageDraft,
  sectionType: HomepageSectionType,
  direction: "up" | "down",
): HomepageDraft {
  const sorted = [...draft.sections].sort((a, b) => a.position - b.position);
  const index = sorted.findIndex(
    (section) => section.sectionType === sectionType,
  );
  if (index < 0) return draft;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= sorted.length) return draft;
  const next = sorted.map((section) => ({ ...section }));
  const currentPos = next[index]!.position;
  next[index]!.position = next[target]!.position;
  next[target]!.position = currentPos;
  return validateHomepageDraft({ sections: next });
}
