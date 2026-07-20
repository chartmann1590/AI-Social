import { NativeModules, Platform } from 'react-native';

export type ContentReportReason =
  | 'Offensive or inappropriate'
  | 'Factually wrong'
  | 'Broken or garbled text'
  | 'Other';

const REASON_LABELS: Record<ContentReportReason, string> = {
  'Offensive or inappropriate': 'reason:offensive',
  'Factually wrong': 'reason:factually-wrong',
  'Broken or garbled text': 'reason:broken-garbled',
  Other: 'reason:other',
};

export const CONTENT_REPORT_REASONS: ContentReportReason[] = [
  'Offensive or inappropriate',
  'Factually wrong',
  'Broken or garbled text',
  'Other',
];

type NativeFeedback = {
  reportContent(
    contentType: 'post' | 'comment',
    content: string,
    reason: string,
    reasonLabel: string,
    note: string | null,
    model: string | null,
  ): Promise<number>;
};

const NativeFeedback = (NativeModules as { AISocialFeedback?: NativeFeedback }).AISocialFeedback;

/**
 * Submits a content report via the native bridge (not a direct fetch from JS) so the
 * feedback-proxy shared secret never has to be embedded in the JS bundle, which is
 * trivially extractable from a decompiled APK unlike a compiled native BuildConfig
 * constant. See native-src/feedback/FeedbackModule.kt.
 */
export async function reportContent(params: {
  contentType: 'post' | 'comment';
  content: string;
  reason: ContentReportReason;
  note?: string;
  model?: string;
}): Promise<number> {
  if (Platform.OS !== 'android' || !NativeFeedback) {
    throw new Error('Reporting is only available on Android release/dev builds.');
  }
  return NativeFeedback.reportContent(
    params.contentType,
    params.content,
    params.reason,
    REASON_LABELS[params.reason],
    params.note?.trim() || null,
    params.model?.trim() || null,
  );
}
