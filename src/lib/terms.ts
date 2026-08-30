export const TERMS_VERSION = "1";
export const TERMS_UPDATED_AT = "30 August 2026";

export function hasAcceptedCurrentTerms(profile: {
  terms_accepted_at?: string | null;
  terms_version?: string | null;
}): boolean {
  return !!profile.terms_accepted_at && profile.terms_version === TERMS_VERSION;
}
