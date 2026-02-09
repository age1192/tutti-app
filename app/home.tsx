import { View, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';
import { colors } from '../styles';
import { TabBar, TabType } from '../components/ui';
import MetronomeScreen from './metronome';
import HarmonyScreen from './harmony';
import PlaybackScreen from './playback';
import SettingsScreen from './settings';

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('metronome');

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
      {/* コンテンツエリア */}
      <View style={styles.content}>
        {activeTab === 'metronome' && <MetronomeScreen />}
        {activeTab === 'harmony' && <HarmonyScreen />}
        {activeTab === 'playback' && <PlaybackScreen />}
        {activeTab === 'settings' && <SettingsScreen />}
      </View>

      {/* タブバー（画面下部） */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
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
});
