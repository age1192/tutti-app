/**
 * 設定画面
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';
import { colors, typography, spacing } from '../styles';
import { useSettingsStore } from '../stores/useSettingsStore';
import { TIME_SIGNATURES, TEMPO_MIN, TEMPO_MAX, PITCH_MIN, PITCH_MAX } from '../utils/constants';
import { TimeSignature, TuningType, ToneType, MetronomeToneType } from '../types';
import { useProgramStore } from '../stores/useProgramStore';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';

export default function SettingsScreen() {
  const router = useRouter();

  // 画面に入った時に横画面固定（home.tsxで管理されているが、念のため）
  useFocusEffect(
    useCallback(() => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      return () => {
        // 画面を離れる時は何もしない（home.tsxで管理）
      };
    }, [])
  );
  const {
    settings,
    isLoading,
    loadSettings,
    setKeepScreenOn,
    setBackgroundPlayback,
    setHapticEnabled,
    setDefaultTempo,
    setDefaultTimeSignature,
    setDefaultPitch,
    setDefaultTuning,
    resetSettings,
  } = useSettingsStore();

  const [tempoInput, setTempoInput] = useState(settings.defaultTempo.toString());
  const [pitchInput, setPitchInput] = useState(settings.defaultPitch.toString());

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    setTempoInput(settings.defaultTempo.toString());
  }, [settings.defaultTempo]);

  useEffect(() => {
    setPitchInput(settings.defaultPitch.toString());
  }, [settings.defaultPitch]);

  const handleTempoSubmit = () => {
    const tempo = parseInt(tempoInput, 10);
    if (!isNaN(tempo) && tempo >= TEMPO_MIN && tempo <= TEMPO_MAX) {
      setDefaultTempo(tempo);
    } else {
      setTempoInput(settings.defaultTempo.toString());
      if (Platform.OS === 'web') {
        window.alert(`テンポは${TEMPO_MIN}〜${TEMPO_MAX}の範囲で入力してください`);
      } else {
        Alert.alert('エラー', `テンポは${TEMPO_MIN}〜${TEMPO_MAX}の範囲で入力してください`);
      }
    }
  };

  const handlePitchSubmit = () => {
    const pitch = parseFloat(pitchInput);
    if (!isNaN(pitch) && pitch >= PITCH_MIN && pitch <= PITCH_MAX) {
      setDefaultPitch(pitch);
    } else {
      setPitchInput(settings.defaultPitch.toString());
      if (Platform.OS === 'web') {
        window.alert(`ピッチは${PITCH_MIN}〜${PITCH_MAX}の範囲で入力してください`);
      } else {
        Alert.alert('エラー', `ピッチは${PITCH_MIN}〜${PITCH_MAX}の範囲で入力してください`);
      }
    }
  };

  const handleResetSettings = () => {
    const confirmMessage = '設定をリセットしますか？';
    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        resetSettings();
      }
    } else {
      Alert.alert('確認', confirmMessage, [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'リセット',
          style: 'destructive',
          onPress: resetSettings,
        },
      ]);
    }
  };

  const appVersion = Constants.expoConfig?.version || '1.0.0';

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 一般設定 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>一般設定</Text>
          
          <SettingRow
            label="画面常時点灯（再生中）"
            value={settings.keepScreenOn}
            onToggle={setKeepScreenOn}
          />
          
          <SettingRow
            label="バックグラウンド再生"
            value={settings.backgroundPlayback}
            onToggle={setBackgroundPlayback}
          />
          
          <SettingRow
            label="振動フィードバック"
            value={settings.hapticEnabled}
            onToggle={setHapticEnabled}
          />
        </View>

        {/* メトロノーム設定 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>メトロノーム設定</Text>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>デフォルトテンポ</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={tempoInput}
                onChangeText={setTempoInput}
                onSubmitEditing={handleTempoSubmit}
                keyboardType="numeric"
                selectTextOnFocus
              />
              <Text style={styles.inputUnit}>BPM</Text>
            </View>
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>デフォルト拍子</Text>
            <View style={styles.chipRow}>
              {TIME_SIGNATURES.map((ts, index) => {
                const isSelected =
                  settings.defaultTimeSignature.numerator === ts.numerator &&
                  settings.defaultTimeSignature.denominator === ts.denominator;
                return (
                  <Pressable
                    key={index}
                    style={[styles.chip, isSelected && styles.chipActive]}
                    onPress={() => setDefaultTimeSignature(ts)}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                      {ts.numerator}/{ts.denominator}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* ハーモニー設定 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ハーモニー設定</Text>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>デフォルトピッチ（A4）</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={pitchInput}
                onChangeText={setPitchInput}
                onSubmitEditing={handlePitchSubmit}
                keyboardType="numeric"
                selectTextOnFocus
              />
              <Text style={styles.inputUnit}>Hz</Text>
            </View>
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>デフォルト調律</Text>
            <View style={styles.chipRow}>
              <Pressable
                style={[
                  styles.chip,
                  settings.defaultTuning === 'equal' && styles.chipActive,
                ]}
                onPress={() => setDefaultTuning('equal')}
              >
                <Text
                  style={[
                    styles.chipText,
                    settings.defaultTuning === 'equal' && styles.chipTextActive,
                  ]}
                >
                  平均律
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.chip,
                  settings.defaultTuning === 'just' && styles.chipActive,
                ]}
                onPress={() => setDefaultTuning('just')}
              >
                <Text
                  style={[
                    styles.chipText,
                    settings.defaultTuning === 'just' && styles.chipTextActive,
                  ]}
                >
                  純正律
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* その他 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>その他</Text>
          
          <Pressable 
            style={styles.actionButton}
            onPress={() => router.push('/help')}
          >
            <Text style={styles.actionButtonText}>ヘルプ</Text>
          </Pressable>

          <Pressable
            style={[styles.actionButton, styles.actionButtonDanger]}
            onPress={handleResetSettings}
          >
            <Text style={[styles.actionButtonText, styles.actionButtonTextDanger]}>
              設定をリセット
            </Text>
          </Pressable>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>アプリバージョン</Text>
            <Text style={styles.infoValue}>{appVersion}</Text>
          </View>
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </View>
  );
}

interface SettingRowProps {
  label: string;
  value: boolean;
  onToggle: (value: boolean) => void;
}

function SettingRow({ label, value, onToggle }: SettingRowProps) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Pressable
        style={[styles.toggle, value && styles.toggleActive]}
        onPress={() => onToggle(!value)}
      >
        <View style={[styles.toggleThumb, value && styles.toggleThumbActive]} />
      </Pressable>
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
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.heading,
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  settingLabel: {
    ...typography.body,
    fontSize: 16,
    color: colors.text.primary,
    flex: 1,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.border.strong,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: colors.functional.harmony,
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.background.secondary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    ...typography.body,
    fontSize: 16,
    color: colors.text.primary,
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    minWidth: 80,
    textAlign: 'right',
  },
  inputUnit: {
    ...typography.body,
    fontSize: 16,
    color: colors.text.secondary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  chipActive: {
    backgroundColor: colors.accent.primaryLight,
    borderColor: colors.accent.primary,
  },
  chipText: {
    ...typography.body,
    fontSize: 14,
    color: colors.text.primary,
  },
  chipTextActive: {
    color: colors.accent.primary,
    fontWeight: '600',
  },
  actionButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    backgroundColor: colors.accent.primary,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  actionButtonDanger: {
    backgroundColor: colors.status.error,
  },
  actionButtonText: {
    ...typography.body,
    fontSize: 16,
    color: colors.background.secondary,
    fontWeight: '600',
  },
  actionButtonTextDanger: {
    color: colors.background.secondary,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  infoLabel: {
    ...typography.body,
    fontSize: 14,
    color: colors.text.secondary,
  },
  infoValue: {
    ...typography.body,
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '600',
  },
});
