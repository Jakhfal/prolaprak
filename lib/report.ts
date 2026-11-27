export type ReportEntry = {
  title: string;
  purpose?: string;
  code?: string;
  compile?: string;
  output?: string;
  analysis?: string;
};
export type Report = {
  title: string;
  subtitle?: string;
  introduction?: string[];
  theory?: string[];
  experiments?: ReportEntry[];
  tasks?: ReportEntry[];
  analysisQuestions?: { question: string; answer: string }[];
  conclusion?: string[];
  notes?: string[];
};
export function safeJson<T>(value: FormDataEntryValue | null, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}