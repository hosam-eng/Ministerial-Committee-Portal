import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { adminShellProps } from "@/app/[locale]/admin/admin-shell-props";
import { routing, type Locale } from "@/i18n/routing";
import {
  AccessDenied,
  LogoutButton,
  PERMISSIONS,
  requireBackoffice,
} from "@/modules/identity";
import { listNewsCategoriesForAdmin } from "@/modules/publishing";
import {
  GeographicAreaAdmin,
  OrganizationAdmin,
  REFERENCE_DATA_NAV,
  TaxonomyAdmin,
  isTaxonomyKind,
  listGeographicAreas,
  listOrganizations,
  listTaxonomies,
  referenceDataSectionFromSlug,
  type GeographicAdminMessages,
  type ReferenceDataNavItem,
  type TaxonomyAdminMessages,
} from "@/modules/reference-data";
import { AdminPageHeader } from "@/shared/ui/admin-page-header";
import { AdminShell } from "@/shared/ui/admin-shell";

import {
  createGeographicAreaAction,
  createOrganizationAction,
  createReferenceTaxonomyAction,
  deleteGeographicAreaForm,
  deleteOrganizationForm,
  deleteReferenceTaxonomyForm,
  setGeographicAreaActiveForm,
  setOrganizationActiveForm,
  setReferenceTaxonomyActiveForm,
  updateGeographicAreaAction,
  updateOrganizationAction,
  updateReferenceTaxonomyAction,
} from "../actions";

export const dynamic = "force-dynamic";

function canManageSection(
  permissions: ReadonlySet<string>,
  item: ReferenceDataNavItem,
) {
  if (item.section === "newsCategory") {
    return permissions.has(PERMISSIONS.NEWS_CATEGORIES_MANAGE);
  }
  if (item.section === "organization") {
    return permissions.has(PERMISSIONS.REFERENCE_DATA_ORGANIZATIONS_MANAGE);
  }
  if (item.section === "geographicArea") {
    return permissions.has(PERMISSIONS.REFERENCE_DATA_GEOGRAPHIC_AREAS_MANAGE);
  }
  return permissions.has(PERMISSIONS.REFERENCE_DATA_TAXONOMIES_MANAGE);
}

export default async function ReferenceDataSectionPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const section = referenceDataSectionFromSlug(slug);
  if (!section) notFound();

  const gate = await requireBackoffice(locale, PERMISSIONS.REFERENCE_DATA_READ);
  const t = await getTranslations({ locale, namespace: "referenceData" });
  const tShell = await getTranslations({ locale });
  const permissions =
    gate.status === "granted" ? gate.permissions : new Set<string>();
  const props = adminShellProps(locale, tShell, permissions, {
    switchHref: `/${routing.locales.find((l) => l !== locale)}/admin/reference-data/${slug}`,
    activeHref: `/${locale}/admin/reference-data/${slug}`,
  });
  const shell = {
    ...props,
    email: gate.status === "granted" ? gate.user.email : "",
    actions: <LogoutButton locale={locale as Locale} />,
    navItems: gate.status === "granted" ? props.navItems : [],
  };

  if (gate.status === "denied") {
    return (
      <AdminShell {...shell}>
        <AccessDenied locale={locale as Locale} />
      </AdminShell>
    );
  }

  const userId = gate.user.id;
  const navItem =
    REFERENCE_DATA_NAV.find((entry) => entry.section === section) ??
    ({ section, slug } as ReferenceDataNavItem);
  const canManage = canManageSection(permissions, navItem);
  const taxonomyMessages = t.raw("taxonomy") as TaxonomyAdminMessages;
  const errors = t.raw("errors") as Record<string, string>;
  taxonomyMessages.errors = errors;

  let body: ReactNode = null;

  if (section === "newsCategory") {
    const rows = await listNewsCategoriesForAdmin(userId);
    body = (
      <TaxonomyAdmin
        locale={locale}
        sectionSlug={slug}
        rows={rows.map((row) => ({
          id: row.id,
          nameAr: row.nameAr,
          nameEn: row.nameEn,
          isActive: row.isActive,
          referenceCount: row.revisionReferenceCount,
        }))}
        canManage={canManage}
        messages={taxonomyMessages}
        createAction={createReferenceTaxonomyAction}
        updateAction={updateReferenceTaxonomyAction}
        setActiveAction={setReferenceTaxonomyActiveForm}
        deleteAction={deleteReferenceTaxonomyForm}
      />
    );
  } else if (section === "organization") {
    const rows = await listOrganizations(userId);
    body = (
      <OrganizationAdmin
        locale={locale}
        sectionSlug={slug}
        rows={rows}
        canManage={canManage}
        messages={{
          ...taxonomyMessages,
          searchLabel: t("organization.searchLabel"),
          searchHint: t("organization.searchHint"),
          similarWarning: t("organization.similarWarning"),
          similarFoundTitle: t("organization.similarFoundTitle"),
          acknowledgeSimilar: t("organization.acknowledgeSimilar"),
          reviewMatches: t("organization.reviewMatches"),
        }}
        searchPlaceholder={t("organization.searchPlaceholder")}
        searchResults={[]}
        createAction={createOrganizationAction}
        updateAction={updateOrganizationAction}
        setActiveAction={setOrganizationActiveForm}
        deleteAction={deleteOrganizationForm}
      />
    );
  } else if (section === "geographicArea") {
    const rows = await listGeographicAreas(userId);
    const geoMessages = {
      ...(t.raw("geographic") as Record<string, string>),
      errors,
    } as GeographicAdminMessages;
    body = (
      <GeographicAreaAdmin
        locale={locale}
        sectionSlug={slug}
        rows={rows}
        canManage={canManage}
        messages={geoMessages}
        createAction={createGeographicAreaAction}
        updateAction={updateGeographicAreaAction}
        setActiveAction={setGeographicAreaActiveForm}
        deleteAction={deleteGeographicAreaForm}
      />
    );
  } else if (isTaxonomyKind(section)) {
    const rows = await listTaxonomies(userId, section);
    body = (
      <TaxonomyAdmin
        locale={locale}
        sectionSlug={slug}
        rows={rows}
        canManage={canManage}
        messages={taxonomyMessages}
        createAction={createReferenceTaxonomyAction}
        updateAction={updateReferenceTaxonomyAction}
        setActiveAction={setReferenceTaxonomyActiveForm}
        deleteAction={deleteReferenceTaxonomyForm}
      />
    );
  } else {
    notFound();
  }

  return (
    <AdminShell {...shell}>
      <Link
        className="admin-editor-back"
        href={`/${locale}/admin/reference-data`}
      >
        {t("back")}
      </Link>
      <AdminPageHeader
        eyebrow={t("title")}
        title={t(`sections.${section}`)}
        description={t("sectionIntro")}
      />
      {body}
    </AdminShell>
  );
}
