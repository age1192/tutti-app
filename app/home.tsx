import { View, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { colors } from '../styles';
import { TabBar, TabType } from '../components/ui';
import { useAudioEngine } from '../hooks';
import { LANDSCAPE_SAFE_AREA_INSET } from '../utils/constants';
import MetronomeScreen from './metronome';
import HarmonyScreen from './harmony';
import PlaybackScreen from './playback';
import SettingsScreen from './settings';

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('metronome');
  const insets = useSafeAreaInsets();

  // 横画面時のノッチ回避: 左右のみ Appleガイドライン 44pt〜59pt を採用（ノッチは横画面で左右に来る）
  const safePadding = {
    top: insets.top,
    bottom: insets.bottom,
    left: Math.max(insets.left, LANDSCAPE_SAFE_AREA_INSET),
    right: Math.max(insets.right, LANDSCAPE_SAFE_AREA_INSET),
  };

  // AudioContext をタブ切り替えで破棄しないよう、HomeScreen で常時マウント
  // （タブごとに useAudioEngine がアンマウントされると refCount=0 で閉じられ、
  //   次のタブで再作成に数百msかかり、最初のタブで音が鳴らないバグの原因になる）
  useAudioEngine();

  // 画面に入った時に横画面固定（タブ切り替え時も維持）
  useFocusEffect(
    useCallback(() => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      return () => {
        // 画面を離れる時だけ縦画面に戻す（タブ切り替え時は戻さない）
      };
    }, [])
  );

  return (
    <View style={styles.container}>
      {/* コンテンツエリア（余白内） */}
      <View
        style={[
          styles.content,
          {
            paddingTop: safePadding.top,
            paddingBottom: safePadding.bottom,
            paddingLeft: safePadding.left,
            paddingRight: safePadding.right,
          },
        ]}
      >
        {activeTab === 'metronome' && <MetronomeScreen />}
        {activeTab === 'harmony' && <HarmonyScreen />}
        {activeTab === 'playback' && <PlaybackScreen />}
        {activeTab === 'settings' && <SettingsScreen />}
      </View>

      {/* タブバー: 背景は画面端まで、ボタンは余白内 */}
      <View
        style={[
          styles.tabBarWrapper,
          {
            marginLeft: -safePadding.left,
            marginRight: -safePadding.right,
            paddingLeft: safePadding.left,
            paddingRight: safePadding.right,
            paddingBottom: Math.max(safePadding.bottom, 8),
          },
        ]}
      >
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
  },
  tabBarWrapper: {
    backgroundColor: colors.background.secondary,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
});
