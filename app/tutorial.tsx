/**
 * チュートリアル画面
 * 初回起動時のガイド
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, typography, spacing } from '../styles';
import { LANDSCAPE_SAFE_AREA_INSET } from '../utils/constants';

const TUTORIAL_PAGES = [
  {
    title: 'ようこそ',
    content: 'このアプリは吹奏楽の練習をサポートするためのツールです。\n\nメトロノーム、ハーモニーディレクター、プログラムメトロノームなどの機能を提供します。',
  },
  {
    title: 'メトロノーム',
    content: 'テンポや拍子を設定して、正確なリズムで練習できます。\n\n• テンポはスライダーやキーボード入力で調整\n• 拍子は1/4から12/8まで対応\n• 拍分割で細かいリズムも練習可能',
  },
  {
    title: 'ハーモニーディレクター',
    content: '和音や音程を確認しながら練習できます。\n\n• 鍵盤モードで個別の音を確認\n• コードパッドでコード進行を練習\n• 平均律と純正律を切り替え可能',
  },
  {
    title: 'プログラムメトロノーム',
    content: '複数のセクションからなるプログラムを作成して、曲全体のテンポや拍子の変化を管理できます。\n\n• セクションごとにテンポ・拍子を設定\n• QRコードでプログラムを共有\n• テンプレート機能でよく使う設定を保存',
  },
  {
    title: 'その他の機能',
    content: '• チューナー: 楽器の音程を測定\n• プリセット: よく使う設定を保存\n• 設定: アプリ全体の設定を管理\n\nそれでは、練習を始めましょう！',
  },
];

export default function TutorialScreen() {
  const insets = useSafeAreaInsets();
  const [currentPage, setCurrentPage] = useState(0);

  const handleNext = () => {
    if (currentPage < TUTORIAL_PAGES.length - 1) {
      setCurrentPage(currentPage + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    const { setFirstLaunchComplete } = await import('../utils/storageUtils');
    await setFirstLaunchComplete();
    router.replace('/');
  };

  const page = TUTORIAL_PAGES[currentPage];
  const isLastPage = currentPage === TUTORIAL_PAGES.length - 1;

  // 横画面時のノッチ回避: 左右のみ 44pt を採用
  const safePadding = {
    top: insets.top,
    bottom: insets.bottom,
    left: Math.max(insets.left, LANDSCAPE_SAFE_AREA_INSET),
    right: Math.max(insets.right, LANDSCAPE_SAFE_AREA_INSET),
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: safePadding.top,
          paddingBottom: safePadding.bottom,
          paddingLeft: safePadding.left,
          paddingRight: safePadding.right,
        },
      ]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.page}>
          <Text style={styles.title}>{page.title}</Text>
          <Text style={styles.content}>{page.content}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {TUTORIAL_PAGES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentPage && styles.dotActive,
              ]}
            />
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>スキップ</Text>
          </Pressable>
          <Pressable style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextButtonText}>
              {isLastPage ? '始める' : '次へ'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  page: {
    alignItems: 'center',
  },
  title: {
    ...typography.heading,
    fontSize: 32,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  content: {
    ...typography.body,
    fontSize: 18,
    lineHeight: 28,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    backgroundColor: colors.background.secondary,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border.default,
  },
  dotActive: {
    backgroundColor: colors.accent.primary,
    width: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  skipButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
  },
  skipButtonText: {
    ...typography.body,
    fontSize: 16,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  nextButton: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.accent.primary,
    alignItems: 'center',
  },
  nextButtonText: {
    ...typography.body,
    fontSize: 16,
    color: colors.background.secondary,
    fontWeight: '600',
  },
});
