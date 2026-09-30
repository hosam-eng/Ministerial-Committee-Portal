import { normalizeOptionalEmail, normalizeOptionalPhone } from "./contact";
import { SiteSettingsError } from "./errors";
import { validateSocialUrl } from "./social-url";

export type SiteSettingsLocale = "ar" | "en";

export type SiteSettingsLocaleFields = {
  officialName: string;
  address: string;
  defaultSeoTitle: string;
  defaultSeoDescription: string;
};

export type SiteSettingsSocialLinkDraft = {
  itemKey: string;
  labelAr: string;
  labelEn: string;
  url: string;
  position: number;
};

export type SiteSettingsDraft = {
  contactEmail: string;
  contactPhone: string;
  translations: Record<SiteSettingsLocale, SiteSettingsLocaleFields>;
  socialLinks: SiteSettingsSocialLinkDraft[];
};

const LOCALES: SiteSettingsLocale[] = ["ar", "en"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function emptyLocale(): SiteSettingsLocaleFields {
  return {
    officialName: "",
    address: "",
    defaultSeoTitle: "",
    defaultSeoDescription: "",
  };
}

function readLocale(value: unknown): SiteSettingsLocaleFields {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return emptyLocale();
  }
  const row = value as Record<string, unknown>;
  return {
    officialName: typeof row.officialName === "string" ? row.officialName : "",
    address: typeof row.address === "string" ? row.address : "",
    defaultSeoTitle:
      typeof row.defaultSeoTitle === "string" ? row.defaultSeoTitle : "",
    defaultSeoDescription:
      typeof row.defaultSeoDescription === "string"
        ? row.defaultSeoDescription
        : "",
  };
}

function readSocialLink(value: unknown): SiteSettingsSocialLinkDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const itemKey = typeof row.itemKey === "string" ? row.itemKey.trim() : "";
  if (!UUID.test(itemKey)) return null;
  const labelAr = typeof row.labelAr === "string" ? row.labelAr.trim() : "";
  const labelEn = typeof row.labelEn === "string" ? row.labelEn.trim() : "";
  const url = typeof row.url === "string" ? row.url : "";
  const position = Number(row.position);
  if (!Number.isInteger(position) || position < 0) return null;
  return { itemKey, labelAr, labelEn, url, position };
}

export function validateSiteSettingsDraft(
  input: unknown,
  strict = false,
): SiteSettingsDraft {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new SiteSettingsError("INVALID_DRAFT");
  }
  const root = input as Record<string, unknown>;
  const contactEmail =
    typeof root.contactEmail === "string" ? root.contactEmail : "";
  const contactPhone =
    typeof root.contactPhone === "string" ? root.contactPhone : "";
  const translationsRaw = root.translations;
  const translations = {
    ar: emptyLocale(),
    en: emptyLocale(),
  };
  if (translationsRaw && typeof translationsRaw === "object") {
    const map = translationsRaw as Record<string, unknown>;
    translations.ar = readLocale(map.ar);
    translations.en = readLocale(map.en);
  }
  const linksRaw = Array.isArray(root.socialLinks) ? root.socialLinks : [];
  const socialLinks = linksRaw
    .map(readSocialLink)
    .filter((link): link is SiteSettingsSocialLinkDraft => link !== null)
    .sort((a, b) => a.position - b.position);

  const draft: SiteSettingsDraft = {
    contactEmail,
    contactPhone,
    translations,
    socialLinks: socialLinks.filter(
      (link) => link.url.trim() || link.labelAr.trim() || link.labelEn.trim(),
    ),
  };

  if (strict) {
    for (const locale of LOCALES) {
      if (!draft.translations[locale].officialName.trim()) {
        throw new SiteSettingsError("BILINGUAL_REQUIRED");
      }
    }
    draft.contactEmail = normalizeOptionalEmail(draft.contactEmail) ?? "";
    draft.contactPhone = normalizeOptionalPhone(draft.contactPhone) ?? "";
  } else {
    if (draft.contactEmail.trim()) {
      draft.contactEmail =
        normalizeOptionalEmail(draft.contactEmail) ?? draft.contactEmail;
    }
    if (draft.contactPhone.trim()) {
      draft.contactPhone =
        normalizeOptionalPhone(draft.contactPhone) ?? draft.contactPhone;
    }
  }

  const seenUrls = new Set<string>();
  for (const link of draft.socialLinks) {
    if (strict && (!link.labelAr || !link.labelEn)) {
      throw new SiteSettingsError("INVALID_DRAFT");
    }
    const normalized = link.url.trim() ? validateSocialUrl(link.url) : "";
    if (strict && !normalized) {
      throw new SiteSettingsError("INVALID_SOCIAL_URL");
    }
    if (normalized) {
      link.url = normalized;
      const key = normalized.toLowerCase();
      if (seenUrls.has(key))
        throw new SiteSettingsError("DUPLICATE_SOCIAL_URL");
      seenUrls.add(key);
    }
  }

  return draft;
}
