/**
 * ヘルプ画面
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, typography, spacing } from '../styles';
import { LANDSCAPE_SAFE_AREA_INSET } from '../utils/constants';

const HELP_SECTIONS = [
  {
    title: 'メトロノーム',
    items: [
      {
        q: 'テンポを変更するには？',
        a: 'スライダーを動かすか、BPM表示をタップしてキーボードで入力できます。',
      },
      {
        q: '拍子を変更するには？',
        a: '拍子ボタンをタップして、モーダルから選択してください。',
      },
      {
        q: '拍分割とは？',
        a: '4分音符、8分音符、3連符、16分音符の音量を個別に調整できます。',
      },
    ],
  },
  {
    title: 'ハーモニーディレクター',
    items: [
      {
        q: '鍵盤モードとコードモードの違いは？',
        a: '鍵盤モードは個別の音を確認、コードモードはコード進行を練習するのに便利です。',
      },
      {
        q: '平均律と純正律の違いは？',
        a: '平均律は12音階を均等に分割した調律、純正律は自然な和音に基づいた調律です。',
      },
      {
        q: '音の持続機能とは？',
        a: '鍵盤モードでは足し算方式（複数の音が重なる）、コードモードでは置き換え方式（最後のコードが持続）です。',
      },
    ],
  },
  {
    title: 'プログラムメトロノーム',
    items: [
      {
        q: 'プログラムの作成方法は？',
        a: 'プログラム一覧画面で「+ 新規」ボタンをタップし、セクションを追加して設定してください。',
      },
      {
        q: 'テンプレート機能とは？',
        a: 'よく使うプログラムをテンプレートとして保存し、ワンタップで呼び出せます。',
      },
      {
        q: 'QRコードで共有するには？',
        a: 'プログラム編集画面で「エクスポート」をタップし、表示されたQRコードを保存または共有してください。',
      },
      {
        q: 'テキスト入力とは？',
        a: '4/4(4)-2+2+3/8(2)のような形式でプログラムを素早く入力できます。',
      },
    ],
  },
  {
    title: 'その他',
    items: [
      {
        q: 'プリセット機能とは？',
        a: 'メトロノームやハーモニーディレクターの設定を保存し、すぐに呼び出せます。',
      },
      {
        q: 'チューナー機能とは？',
        a: 'マイクから入力された音の周波数を測定し、基準ピッチとの差を表示します。',
      },
      {
        q: '設定はどこで変更できますか？',
        a: '設定タブから、アプリ全体の設定を変更できます。',
      },
    ],
  },
];

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [expandedSection, setExpandedSection] = useState<number | null>(null);

  const handleContact = () => {
    // 問い合わせ先のURL（実際のURLに置き換えてください）
    const contactUrl = 'https://example.com/contact';
    Linking.openURL(contactUrl).catch((err) => {
      console.error('Failed to open contact URL:', err);
      if (Platform.OS === 'web') {
        window.alert('問い合わせページを開けませんでした');
      }
    });
  };

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
        {/* ヘッダー */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>ヘルプ</Text>
        </View>

        {HELP_SECTIONS.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Pressable
              style={styles.sectionHeader}
              onPress={() =>
                setExpandedSection(
                  expandedSection === sectionIndex ? null : sectionIndex
                )
              }
            >
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.expandIcon}>
                {expandedSection === sectionIndex ? '▼' : '▶'}
              </Text>
            </Pressable>

            {expandedSection === sectionIndex && (
              <View style={styles.items}>
                {section.items.map((item, itemIndex) => (
                  <View key={itemIndex} style={styles.item}>
                    <Text style={styles.question}>Q: {item.q}</Text>
                    <Text style={styles.answer}>A: {item.a}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* 問い合わせ */}
        <View style={styles.section}>
          <Pressable style={styles.contactButton} onPress={handleContact}>
            <Text style={styles.contactButtonText}>お問い合わせ</Text>
          </Pressable>
        </View>
      </ScrollView>
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
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  backButton: {
    padding: spacing.sm,
    marginRight: spacing.md,
  },
  backButtonText: {
    ...typography.heading,
    fontSize: 24,
    fontWeight: '600',
    color: colors.text.primary,
  },
  headerTitle: {
    ...typography.heading,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
  },
  headerSpacer: {
    width: 40,
  },
  title: {
    ...typography.heading,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.heading,
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
  },
  expandIcon: {
    ...typography.body,
    fontSize: 16,
    color: colors.text.secondary,
  },
  items: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  item: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  question: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '600',
    color: colors.accent.primary,
    marginBottom: spacing.sm,
  },
  answer: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.secondary,
  },
  contactButton: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
    backgroundColor: colors.accent.primary,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  contactButtonText: {
    ...typography.body,
    fontSize: 18,
    fontWeight: '700',
    color: colors.background.secondary,
  },
});
