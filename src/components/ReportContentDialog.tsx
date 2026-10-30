import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Button, Checkbox, Dialog, Portal, RadioButton, Text, TextInput } from 'react-native-paper';
import { CONTENT_REPORT_REASONS, ContentReportReason, reportContent } from '../services/contentReport';
import { useSettingsStore } from '../store';
import { useModerationStore } from '../store/moderation';

interface ReportContentDialogProps {
  visible: boolean;
  onDismiss: () => void;
  contentType: 'post' | 'comment' | 'image';
  content: string;
  /** Stable id of the reported item; it is hidden on this phone as soon as it is reported. */
  contentId?: string;
  /** Author handle, so the user can also hide everything from that author. */
  authorHandle?: string;
  /** Called after the item was recorded and hidden (e.g. to remove an image). */
  onReported?: () => void;
}

export const ReportContentDialog: React.FC<ReportContentDialogProps> = ({
  visible,
  onDismiss,
  contentType,
  content,
  contentId,
  authorHandle,
  onReported,
}) => {
  const [reason, setReason] = useState<ContentReportReason>(CONTENT_REPORT_REASONS[0]!);
  const [note, setNote] = useState('');
  const [muteAuthor, setMuteAuthor] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const llmMode = useSettingsStore((s) => s.llmMode);
  const model = useSettingsStore((s) => s.model);
  const localModelPath = useSettingsStore((s) => s.localModelPath);
  const recordReport = useModerationStore((s) => s.recordReport);
  const markSent = useModerationStore((s) => s.markSent);
  const mute = useModerationStore((s) => s.muteAuthor);

  const canMute = !!authorHandle && authorHandle.replace(/^@/, '') !== 'me';

  const handleClose = () => {
    if (submitting) return;
    setNote('');
    setMuteAuthor(false);
    setReason(CONTENT_REPORT_REASONS[0]!);
    onDismiss();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    // 1) Record + hide locally first, so the content disappears right away
    //    even if the phone is offline.
    const reportId = recordReport({
      type: contentType,
      contentId: contentId ?? '',
      reason,
      note: note.trim() || undefined,
      excerpt: content.slice(0, 280),
      authorHandle,
    });
    if (muteAuthor && canMute && authorHandle) {
      mute(authorHandle);
    }
    onReported?.();
    // 2) Send a copy to the developer for review.
    try {
      const activeModel = llmMode === 'remote' ? model : localModelPath || model;
      await reportContent({ contentType, content, reason, note, model: activeModel });
      markSent(reportId);
      Alert.alert('Reported and hidden', 'Thanks. It is hidden on your phone and was sent to the developer for review.');
    } catch {
      Alert.alert(
        'Reported and hidden',
        'It is hidden on your phone and your report is saved. It could not be sent to the developer right now.',
      );
    } finally {
      setSubmitting(false);
      setNote('');
      setMuteAuthor(false);
      setReason(CONTENT_REPORT_REASONS[0]!);
      onDismiss();
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={handleClose}>
        <Dialog.Title>Report this {contentType}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <View>
            <Text variant="bodySmall" style={styles.preview} numberOfLines={3}>
              {content}
            </Text>
            <RadioButton.Group onValueChange={(v) => setReason(v as ContentReportReason)} value={reason}>
              {CONTENT_REPORT_REASONS.map((r) => (
                <RadioButton.Item key={r} label={r} value={r} />
              ))}
            </RadioButton.Group>
            {canMute && (
              <Checkbox.Item
                label={`Also hide everything from ${authorHandle!.startsWith('@') ? authorHandle : `@${authorHandle}`}`}
                status={muteAuthor ? 'checked' : 'unchecked'}
                onPress={() => setMuteAuthor((v) => !v)}
              />
            )}
            <TextInput
              label="Additional context (optional)"
              value={note}
              onChangeText={setNote}
              multiline
              style={styles.note}
            />
            <Text variant="bodySmall" style={styles.hint}>
              Reported content is hidden on your phone right away.
            </Text>
          </View>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onPress={handleSubmit} loading={submitting} disabled={submitting}>
            Report
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  scrollArea: {
    maxHeight: 460,
    paddingHorizontal: 12,
  },
  preview: {
    marginTop: 8,
    marginBottom: 12,
    opacity: 0.7,
  },
  note: {
    marginTop: 8,
  },
  hint: {
    marginTop: 8,
    marginBottom: 8,
    opacity: 0.7,
  },
});
