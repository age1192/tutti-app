/**
 * QRコードインポートモーダル
 * QRコードをスキャン、またはファイルからインポート
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Platform } from 'react-native';
import { FadeModal } from '../ui/FadeModal';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
// @ts-ignore - jsqr has no type definitions
import jsQR from 'jsqr';
import { Program } from '../../types';
import { colors, spacing } from '../../styles';
import { decodeProgramBase64 } from '../../utils/qrCodeUtils';

interface QRCodeImportModalProps {
  visible: boolean;
  onClose: () => void;
  onImport: (program: Program) => void;
}

export const QRCodeImportModal: React.FC<QRCodeImportModalProps> = ({
  visible,
  onClose,
  onImport,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  // iOS: モーダル表示完了後にカメラをマウント（同時マウントでクラッシュする場合がある）
  useEffect(() => {
    if (visible && permission?.granted) {
      const timer = setTimeout(() => setShowCamera(true), 400);
      return () => {
        clearTimeout(timer);
        setShowCamera(false);
        setCameraReady(false);
      };
    } else {
      setShowCamera(false);
      setCameraReady(false);
    }
  }, [visible, permission?.granted]);

  // カメラ権限をリクエスト
  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
  }, [visible, permission, requestPermission]);

  // モーダルが閉じられたらスキャン状態をリセット
  useEffect(() => {
    if (!visible) {
      setScanned(false);
      setIsLoading(false);
    }
  }, [visible]);

  // QRコードスキャン時の処理
  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    
    const program = decodeProgramBase64(data);
    if (program) {
      onImport(program);
      onClose();
    } else {
      Alert.alert('エラー', '無効なQRコードデータです');
      setScanned(false);
    }
  };

  // ファイルからインポート
  const handleFileImport = async () => {
    try {
      setIsLoading(true);
      
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/png', 'image/jpeg', 'image/jpg'],
        copyToCacheDirectory: Platform.OS !== 'web',
      });

      if (result.canceled) {
        setIsLoading(false);
        return;
      }

      const file = result.assets[0];
      console.log('Selected file:', file);
      
      // QRコード画像からデータを読み取る
      try {
        let qrData: string | null = null;
        
        if (Platform.OS === 'web') {
          // Webの場合はjsQRを使用
          let imageUrl: string;
          let shouldRevokeUrl = false;
          
          // WebではDocumentPickerがFileオブジェクトを返す可能性がある
          // file.uriがblob:またはdata:で始まる場合はそのまま使用
          if (file.uri.startsWith('blob:') || file.uri.startsWith('data:')) {
            imageUrl = file.uri;
          } else {
            // file.uriがファイルパスの場合、Fileオブジェクトから直接Blob URLを作成
            try {
              // Web環境では、file.uriがFileオブジェクトの可能性がある
              // または、fetchで取得できるURLの場合もある
              const response = await fetch(file.uri);
              if (response.ok) {
                const blob = await response.blob();
                imageUrl = URL.createObjectURL(blob);
                shouldRevokeUrl = true;
              } else {
                throw new Error('Failed to fetch file');
              }
            } catch (fetchError) {
              // fetchが失敗した場合、Fileオブジェクトとして扱う
              // Web環境では、fileオブジェクトが直接利用可能な場合がある
              console.log('Fetch failed, trying alternative method:', fetchError);
              
              // FileReaderを使用してファイルを読み込む
              const fileReader = new FileReader();
              imageUrl = await new Promise<string>((resolve, reject) => {
                fileReader.onload = (e) => {
                  if (e.target?.result) {
                    resolve(e.target.result as string);
                  } else {
                    reject(new Error('Failed to read file'));
                  }
                };
                fileReader.onerror = reject;
                
                // file.uriがFileオブジェクトの場合
                if (file.uri instanceof File) {
                  fileReader.readAsDataURL(file.uri);
                } else {
                  // それ以外の場合は、FileSystemを使用
                  FileSystem.readAsStringAsync(file.uri, {
                    encoding: FileSystem.EncodingType.Base64,
                  }).then((base64) => {
                    resolve(`data:${file.mimeType || 'image/png'};base64,${base64}`);
                  }).catch(reject);
                }
              });
            }
          }
          
          try {
            // 画像を読み込んでCanvasに描画してQRコードを読み取る
            // Web環境ではHTMLImageElementを使用
            const img = document.createElement('img');
            img.crossOrigin = 'anonymous';
            
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = (e) => {
                reject(new Error(`Failed to load image: ${String(e)}`));
              };
              img.src = imageUrl;
            });
            
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              throw new Error('Canvas context not available');
            }
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            
            // Object URLをクリーンアップ
            if (shouldRevokeUrl && imageUrl.startsWith('blob:')) {
              URL.revokeObjectURL(imageUrl);
            }
            
            if (code) {
              qrData = code.data;
            } else {
              window.alert('エラー: QRコードが見つかりませんでした');
              setIsLoading(false);
              return;
            }
          } catch (imgError) {
            // Object URLをクリーンアップ
            if (shouldRevokeUrl && imageUrl.startsWith('blob:')) {
              URL.revokeObjectURL(imageUrl);
            }
            console.error('Image processing error:', imgError);
            throw imgError;
          }
        } else {
          // ネイティブではファイルからのQR読み取りは未対応（expo-barcode-scanner 非推奨のため）
          // Web版では jsQR を使用
          Alert.alert(
            'お知らせ',
            'ファイルから読み取る機能はWeb版でご利用ください。この端末ではカメラでQRコードをスキャンしてください。'
          );
          return;
        }
        
        if (qrData) {
          console.log('QR data found:', qrData.substring(0, 100) + '...');
          const program = decodeProgramBase64(qrData);
          console.log('Decoded program:', program);
          
          if (program) {
            console.log('Calling onImport with program:', program.name);
            onImport(program);
            onClose();
          } else {
            console.error('Failed to decode program from QR data');
            if (Platform.OS === 'web') {
              window.alert('エラー: 無効なQRコードデータです。QRコードがこのアプリで生成されたものか確認してください。');
            } else {
              Alert.alert('エラー', '無効なQRコードデータです');
            }
          }
        } else {
          console.error('No QR data extracted');
        }
      } catch (error) {
        console.error('QR scan error:', error);
        const errorMsg = `QRコードの読み取りに失敗しました: ${error instanceof Error ? error.message : String(error)}`;
        if (Platform.OS === 'web') {
          window.alert(`エラー: ${errorMsg}`);
        } else {
          Alert.alert('エラー', errorMsg);
        }
      }
    } catch (error) {
      console.error('File import error:', error);
      if (Platform.OS === 'web') {
        window.alert('エラー: ファイルの読み込みに失敗しました');
      } else {
        Alert.alert('エラー', 'ファイルの読み込みに失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FadeModal
      visible={visible}
      transparent
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}
    >
      <Pressable style={styles.overlay} onPress={onClose} activeOpacity={1}>
        <Pressable style={styles.modal} onPress={() => {}} activeOpacity={1}>
          <View style={styles.modalContent}>
            <View style={styles.header}>
              <Text style={styles.title}>QRコードでインポート</Text>
              <Pressable style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            <Text style={styles.instruction}>
              QRコードをスキャンするか、データを直接入力してください
            </Text>

            {/* QRコードスキャンエリア（iOS: カメラは遅延マウント、onCameraReady 後にスキャン有効化） */}
            {permission?.granted ? (
              <View style={styles.scanArea}>
                {showCamera ? (
                  <CameraView
                    style={StyleSheet.absoluteFillObject}
                    facing="back"
                    onBarcodeScanned={
                      cameraReady && !scanned ? handleBarCodeScanned : undefined
                    }
                    onCameraReady={() => setCameraReady(true)}
                    barcodeScannerSettings={{
                      barcodeTypes: ['qr'],
                    }}
                  />
                ) : (
                  <View style={styles.scanAreaPlaceholder}>
                    <Text style={styles.scanPlaceholder}>カメラを準備中...</Text>
                  </View>
                )}
                {scanned && (
                  <View style={styles.scanOverlay}>
                    <Text style={styles.scanSuccessText}>✓ スキャン完了</Text>
                    <Pressable
                      style={styles.scanAgainBtn}
                      onPress={() => setScanned(false)}
                    >
                      <Text style={styles.scanAgainBtnText}>再スキャン</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ) : permission === null ? (
              <View style={styles.scanArea}>
                <Text style={styles.scanPlaceholder}>カメラ権限をリクエスト中...</Text>
              </View>
            ) : (
              <View style={styles.scanArea}>
                <Text style={styles.scanPlaceholder}>カメラ権限が必要です</Text>
                <Pressable style={styles.permissionBtn} onPress={requestPermission}>
                  <Text style={styles.permissionBtnText}>権限をリクエスト</Text>
                </Pressable>
              </View>
            )}

            <Text style={styles.orLabel}>または</Text>

            {/* ファイル選択ボタン */}
            <Pressable 
              style={[styles.fileBtn, isLoading && styles.fileBtnDisabled]} 
              onPress={handleFileImport}
              disabled={isLoading}
            >
              <Text style={styles.fileBtnText}>
                {isLoading ? '読み込み中...' : 'ファイルを選択'}
              </Text>
              <Text style={styles.fileBtnHint}>
                PNG/JPEG 画像ファイル
              </Text>
            </Pressable>

            <View style={styles.actions}>
              <Pressable style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>キャンセル</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </FadeModal>
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
    width: '90%',
    maxWidth: 500,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalContent: {
    padding: spacing.md,
    maxHeight: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  instruction: {
    fontSize: 12,
    color: colors.text.muted,
    marginBottom: spacing.md,
  },
  scanArea: {
    height: 200,
    backgroundColor: colors.background.tertiary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  scanAreaPlaceholder: {
    height: 200,
    backgroundColor: colors.background.tertiary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  scanPlaceholder: {
    fontSize: 14,
    color: colors.text.muted,
    textAlign: 'center',
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanSuccessText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: spacing.md,
  },
  scanAgainBtn: {
    backgroundColor: colors.functional.rhythm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
  },
  scanAgainBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  permissionBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.functional.rhythm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
  },
  permissionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  orLabel: {
    fontSize: 12,
    color: colors.text.muted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  fileBtn: {
    backgroundColor: colors.functional.rhythm,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  fileBtnDisabled: {
    opacity: 0.6,
  },
  fileBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  fileBtnHint: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
});
