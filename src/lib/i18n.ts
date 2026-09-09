/**
 * Minimal localization structure (EN/TH). The structure supports future
 * translation files; the MVP ships English strings and Thai stubs. See
 * requirements.md §12.3.
 */
export type Locale = "en" | "th";

type Dict = Record<string, string>;

const en: Dict = {
  "app.name": "Cisco Wi-Fi Planner",
  "dashboard.title": "Projects",
  "dashboard.new": "New project",
  "dashboard.empty": "No projects yet. Create your first design.",
  "workspace.simulate": "Simulate",
  "workspace.cancel": "Cancel",
  "disclaimer.predictive":
    "Predictive estimates only. Validate the final design with an on-site survey and applicable regulatory requirements.",
  "disclaimer.catalog":
    "Cisco specifications are sample/unverified. Verify with official Cisco documentation.",
};

// Thai stubs — structure present; strings to be translated. Falls back to EN.
const th: Dict = {
  "app.name": "เครื่องมือวางแผน Wi-Fi ของ Cisco",
  "dashboard.title": "โครงการ",
  "dashboard.new": "โครงการใหม่",
};

const dicts: Record<Locale, Dict> = { en, th };

export function t(key: string, locale: Locale = "en"): string {
  return dicts[locale][key] ?? dicts.en[key] ?? key;
}
