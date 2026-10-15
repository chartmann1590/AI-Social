import React from 'react';
import { Text, type TextProps } from 'react-native-paper';
import { useTranslatedText } from '../hooks/useTranslatedText';

type Props = TextProps<typeof Text> & {
  children?: string;
};

/** Renders `children` translated to the user's chosen language via on-device ML Kit. */
export const TranslatedText = ({ children, ...rest }: Props) => {
  const source = children ?? '';
  const { text } = useTranslatedText(source);
  return <Text {...rest}>{text}</Text>;
};