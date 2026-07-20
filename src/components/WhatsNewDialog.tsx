import React from 'react';
import { StyleSheet } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import { WHATS_NEW } from '../data/whatsNew';
import { hasUnseenWhatsNew, useUserStore, useWhatsNewStore } from '../store';

export const WhatsNewDialog: React.FC = () => {
  const onboardingComplete = useUserStore((s) => s.onboardingComplete);
  const lastSeenId = useWhatsNewStore((s) => s.lastSeenId);
  const markSeen = useWhatsNewStore((s) => s.markSeen);
  const latest = WHATS_NEW[0];

  const visible = onboardingComplete && latest != null && hasUnseenWhatsNew(lastSeenId);

  if (!latest) return null;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={() => markSeen(latest.id)}>
        <Dialog.Title>{latest.title}</Dialog.Title>
        <Dialog.Content>
          {latest.notes.map((note, i) => (
            <Text key={i} variant="bodyMedium" style={styles.note}>
              {'•'} {note}
            </Text>
          ))}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => markSeen(latest.id)}>Got it</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  note: {
    marginBottom: 8,
  },
});
