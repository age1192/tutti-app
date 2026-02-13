/**
 * QRコードエクスポートモーダル
 * プログラムをQRコードとして表示
 */
import React, { useRef } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Dimensions, Platform, Alert, ScrollView } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import ViewShot from 'react-native-view-shot';
import { Program } from '../../types';
import { colors, spacing } from '../../styles';
import { encodeProgramBase64 } from '../../utils/qrCodeUtils';

interface QRCodeExportModalProps {
  visible: boolean;
  program: Program | null;
  onClose: () => void;
}

export const QRCodeExportModal: React.FC<QRCodeExportModalProps> = ({
  visible,
  program,
  onClose,
}) => {
  const qrViewRef = useRef<ViewShot>(null);
  const qrRef = useRef<any>(null);
  
  if (!program) return null;

  const screenWidth = Dimensions.get('window').width;
  const qrSize = Math.min(screenWidth - 100, 250);

  const qrData = encodeProgramBase64(program);

  // QRコード画像を保存/共有
  const handleShare = async () => {
    try {
      if (Platform.OS === 'web') {
        // WebではQRCode componentのtoDataURLを使用
        if (qrRef.current) {
          qrRef.current.toDataURL((dataURL: string) => {
            const link = document.createElement('a');
            link.href = `data:image/png;base64,${dataURL}`;
            link.download = `${program.name.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '_')}_qr.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.alert('QRコードをダウンロードしました');
          });
        } else {
          window.alert('エラー: QRコードの生成に失敗しました');
        }
      } else {
        // ネイティブの場合はViewShotを使用
        if (!qrViewRef.current) {
          Alert.alert('エラー', 'QRコードの生成に失敗しました');
          return;
        }
        const uri = await qrViewRef.current.capture();
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: 'QRコードを共有',
          });
        } else {
          Alert.alert('エラー', '共有機能が利用できません');
        }
      }
    } catch (error) {
      console.error('Share error:', error);
      const errorMsg = `QRコードの共有に失敗しました: ${error instanceof Error ? error.message : String(error)}`;
      if (Platform.OS === 'web') {
        window.alert(`エラー: ${errorMsg}`);
      } else {
        Alert.alert('エラー', errorMsg);
      }
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>QRコードでエクスポート</Text>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.programName}>{program.name}</Text>

          {/* QRコード表示エリア */}
          <ViewShot ref={qrViewRef} style={styles.qrViewShot} options={{ format: 'png', quality: 1.0 }}>
            <View style={[styles.qrContainer, { width: qrSize, height: qrSize }]}>
              <QRCode
                value={qrData}
                size={qrSize - 40}
                color={colors.text.primary}
                backgroundColor="#FFFFFF"
                getRef={(ref) => (qrRef.current = ref)}
              />
            </View>
          </ViewShot>

          <Text style={styles.instruction}>
            このQRコードをスキャンしてプログラムをインポートできます
          </Text>

          <View style={styles.actions}>
            <Pressable style={styles.shareButton} onPress={handleShare}>
              <Text style={styles.shareButtonText}>
                {Platform.OS === 'web' ? 'ダウンロード' : '共有'}
              </Text>
            </Pressable>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>閉じる</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modal: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: spacing.md,
    width: '90%',
    maxWidth: 350,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 18,
    color: colors.text.secondary,
  },
  programName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.functional.rhythm,
    marginBottom: spacing.md,
  },
  qrContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  qrPlaceholder: {
    fontSize: 14,
    color: colors.text.muted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  qrData: {
    fontSize: 8,
    color: colors.text.muted,
    fontFamily: 'monospace',
  },
  instruction: {
    fontSize: 12,
    color: colors.text.muted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  qrViewShot: {
    backgroundColor: 'transparent',
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    gap: spacing.md,
  },
  shareButton: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.accent.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeButton: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.functional.rhythm,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
