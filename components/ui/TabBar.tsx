/**
 * タブバーコンポーネント
 * MetronomeとHarmonyを切り替えるタブ
 */
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, typography, spacing } from '../../styles';

export type TabType = 'metronome' | 'harmony' | 'playback' | 'settings';

interface TabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.tab, activeTab === 'metronome' && styles.tabActive]}
        onPress={() => onTabChange('metronome')}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === 'metronome' && styles.tabTextActive,
          ]}
        >
          メトロノーム
        </Text>
      </Pressable>

      <Pressable
        style={[styles.tab, activeTab === 'harmony' && styles.tabActive]}
        onPress={() => onTabChange('harmony')}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === 'harmony' && styles.tabTextActive,
          ]}
        >
          ハーモニー
        </Text>
      </Pressable>

      <Pressable
        style={[styles.tab, activeTab === 'playback' && styles.tabActive]}
        onPress={() => onTabChange('playback')}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === 'playback' && styles.tabTextActive,
          ]}
        >
          コード再生
        </Text>
      </Pressable>

      <Pressable
        style={[styles.tab, activeTab === 'settings' && styles.tabActive]}
        onPress={() => onTabChange('settings')}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === 'settings' && styles.tabTextActive,
          ]}
        >
          設定
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderTopWidth: 2,
    borderTopColor: 'transparent',
  },
  tabActive: {
    borderTopColor: colors.functional.rhythm,
  },
  tabText: {
    ...typography.body,
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.functional.rhythm,
    fontWeight: '600',
  },
});
