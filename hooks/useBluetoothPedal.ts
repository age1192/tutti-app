/**
 * Bluetoothペダルフック
 * 外部ペダルデバイスからの入力を検出してホールドモードを制御
 * 
 * 注意: 実際のBluetooth接続は後で実装（現在はキーボードイベントでシミュレート）
 */
import { useEffect, useCallback, useState } from 'react';
import { Platform } from 'react-native';

interface UseBluetoothPedalReturn {
  isConnected: boolean;
  isPedalPressed: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export function useBluetoothPedal(
  onPedalPress?: () => void,
  onPedalRelease?: () => void
): UseBluetoothPedalReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isPedalPressed, setIsPedalPressed] = useState(false);

  // キーボードイベントでシミュレート（開発用）
  useEffect(() => {
    if (!isConnected) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // スペースキーでペダル押下をシミュレート
      if (e.code === 'Space' && !isPedalPressed) {
        e.preventDefault();
        setIsPedalPressed(true);
        onPedalPress?.();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isPedalPressed) {
        e.preventDefault();
        setIsPedalPressed(false);
        onPedalRelease?.();
      }
    };

    if (Platform.OS === 'web') {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
    }

    return () => {
      if (Platform.OS === 'web') {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      }
    };
  }, [isConnected, isPedalPressed, onPedalPress, onPedalRelease]);

  const connect = useCallback(async () => {
    // TODO: 実際のBluetooth接続を実装
    // 現在はシミュレーション
    setIsConnected(true);
  }, []);

  const disconnect = useCallback(() => {
    setIsConnected(false);
    setIsPedalPressed(false);
  }, []);

  return {
    isConnected,
    isPedalPressed,
    connect,
    disconnect,
  };
}
