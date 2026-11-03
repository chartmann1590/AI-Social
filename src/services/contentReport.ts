import { crashlyticsLog, getAnalytics, getCrashlytics, logEvent, recordError } from './firebase';

export type ContentReportReason =
  | 'Sexual or explicit content'
  | 'Offensive or inappropriate'
  | 'Factually wrong'
  | 'Broken or garbled text'
  | 'Other';

const REASON_LABELS: Record<ContentReportReason, string> = {
  // Uses an existing label the feedback proxy already allows (no proxy redeploy needed).
  'Sexual or explicit content': 'reason:offensive',
  'Offensive or inappropriate': 'reason:offensive',
  'Factually wrong': 'reason:factually-wrong',
  'Broken or garbled text': 'reason:broken-garbled',
  Other: 'reason:other',
};

export const CONTENT_REPORT_REASONS: ContentReportReason[] = [
  'Sexual or explicit content',
  'Offensive or inappropriate',
  'Factually wrong',
  'Broken or garbled text',
  'Other',
];

/**
 * Sends a copy of a content report to the developer through Firebase Crashlytics
 * (a non-fatal report the developer reviews in the private Firebase console) plus an
 * Analytics event with the reason. Nothing is posted anywhere public.
 * Crashlytics queues the report on the phone and uploads it when the phone is online.
 */
export async function reportContent(params: {
  contentType: 'post' | 'comment' | 'image';
  content: string;
  reason: ContentReportReason;
  note?: string;
  model?: string;
}): Promise<number> {
  const crashlytics = getCrashlytics();
  const excerpt = params.content.replace(/\s+/g, ' ').slice(0, 900);
  const note = params.note?.trim().slice(0, 500) || '-';
  const model = params.model?.trim().slice(0, 120) || '-';
  crashlyticsLog(crashlytics, `content_report type=${params.contentType} reason=${params.reason}`);
  crashlyticsLog(crashlytics, `content_report model=${model}`);
  crashlyticsLog(crashlytics, `content_report note=${note}`);
  crashlyticsLog(crashlytics, `content_report excerpt=${excerpt}`);
  const err = new Error(`[Content Report] ${params.reason} (${params.contentType}): ${excerpt.slice(0, 200)}`);
  err.name = 'ContentReport';
  recordError(crashlytics, err);
  await logEvent(getAnalytics(), 'content_report', {
    content_type: params.contentType,
    reason: REASON_LABELS[params.reason],
  });
  return 0;
}
