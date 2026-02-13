/**
 * スムーズなフェードイン付きモーダル
 * 画面の乱れを防ぎ、ぬるっと出現する
 */
import React from 'react';
import { Modal, Animated, ModalProps } from 'react-native';
import { useFadeIn } from '../../hooks';

interface FadeModalProps extends ModalProps {
  children: React.ReactNode;
}

export function FadeModal({ visible, children, ...modalProps }: FadeModalProps) {
  const opacity = useFadeIn(visible);

  return (
    <Modal visible={visible} animationType="none" {...modalProps}>
      <Animated.View style={{ flex: 1, opacity }}>{children}</Animated.View>
    </Modal>
  );
}
