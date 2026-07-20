import React, { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { Button, Dialog, Portal, RadioButton, Text, TextInput } from 'react-native-paper';
import { CONTENT_REPORT_REASONS, ContentReportReason, reportContent } from '../services/contentReport';
import { useSettingsStore } from '../store';

interface ReportContentDialogProps {
  visible: boolean;
  onDismiss: () => void;
  contentType: 'post' | 'comment';
  content: string;
}

export const ReportContentDialog: React.FC<ReportContentDialogProps> = ({
  visible,
  onDismiss,
  contentType,
  content,
}) => {
  const [reason, setReason] = useState<ContentReportReason>(CONTENT_REPORT_REASONS[0]!);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const llmMode = useSettingsStore((s) => s.llmMode);
  const model = useSettingsStore((s) => s.model);
  const localModelPath = useSettingsStore((s) => s.localModelPath);

  const handleClose = () => {
    if (submitting) return;
    setNote('');
    setReason(CONTENT_REPORT_REASONS[0]!);
    onDismiss();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const activeModel = llmMode === 'remote' ? model : localModelPath || model;
      await reportContent({ contentType, content, reason, note, model: activeModel });
      Alert.alert('Report sent', 'Thanks — this has been sent to the developer.');
      handleClose();
    } catch (e) {
      const detail = e instanceof Error ? e.message : 'Unknown error';
      Alert.alert('Could not send report', detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={handleClose}>
        <Dialog.Title>Report this {contentType}</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodySmall" style={styles.preview} numberOfLines={3}>
            {content}
          </Text>
          <RadioButton.Group onValueChange={(v) => setReason(v as ContentReportReason)} value={reason}>
            {CONTENT_REPORT_REASONS.map((r) => (
              <RadioButton.Item key={r} label={r} value={r} />
            ))}
          </RadioButton.Group>
          <TextInput
            label="Additional context (optional)"
            value={note}
            onChangeText={setNote}
            multiline
            style={styles.note}
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onPress={handleSubmit} loading={submitting} disabled={submitting}>
            Submit
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  preview: {
    marginBottom: 12,
    opacity: 0.7,
  },
  note: {
    marginTop: 8,
  },
});
