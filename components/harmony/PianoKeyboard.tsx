/**
 * リアルなピアノ鍵盤コンポーネント
 * - 白鍵の上に黒鍵を配置
 * - グリッサンド（スライド操作）対応
 * - 2オクターブ表示
 * - スマホサイズ対応（iPhone SE〜Pro Max）
 */
import { View, StyleSheet, Dimensions, PanResponder, GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { colors } from '../../styles';

// 鍵盤の定義
interface KeyDefinition {
  note: string;      // 音名 (C, C#, D, etc.)
  midi: number;      // MIDIノート番号
  isBlack: boolean;  // 黒鍵かどうか
  position: number;  // 白鍵の位置インデックス（黒鍵の配置用）
}

// 1オクターブの鍵盤定義
const OCTAVE_KEYS = [
  { note: 'C', isBlack: false, offset: 0 },
  { note: 'C#', isBlack: true, offset: 0 },
  { note: 'D', isBlack: false, offset: 1 },
  { note: 'D#', isBlack: true, offset: 1 },
  { note: 'E', isBlack: false, offset: 2 },
  { note: 'F', isBlack: false, offset: 3 },
  { note: 'F#', isBlack: true, offset: 3 },
  { note: 'G', isBlack: false, offset: 4 },
  { note: 'G#', isBlack: true, offset: 4 },
  { note: 'A', isBlack: false, offset: 5 },
  { note: 'A#', isBlack: true, offset: 5 },
  { note: 'B', isBlack: false, offset: 6 },
];

// スマホの基準サイズ（横画面時の高さ）
// iPhone SE: 375, iPhone 14: 390, iPhone 14 Pro Max: 430
const CONTROL_AREA_HEIGHT = 56;  // コントロールパネル（SafeArea含む）
const INFO_BAR_HEIGHT = 48;      // コード/Hz表示エリア
const KEYBOARD_PADDING = 8;      // 鍵盤周りのパディング

interface PianoKeyboardProps {
  startOctave: number;      // 開始オクターブ
  octaveCount?: number;     // 表示オクターブ数（デフォルト2）
  activeNotes: Set<number>; // アクティブなノート
  holdMode?: boolean;       // ホールドモード（離しても音が続く）
  maxHeight?: number;       // 最大高さ（外部から制御）
  onNoteOn: (midi: number) => void;
  onNoteOff: (midi: number) => void;
  onNotesChange?: (midiNotes: number[]) => void; // グリッサンド用
}

export function PianoKeyboard({
  startOctave,
  octaveCount = 2,
  activeNotes,
  holdMode = false,
  maxHeight,
  onNoteOn,
  onNoteOff,
  onNotesChange,
}: PianoKeyboardProps) {
  const containerRef = useRef<View>(null);
  const [layout, setLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const currentNotesRef = useRef<Set<number>>(new Set());
  const lastNoteRef = useRef<number | null>(null); // 最後に押した音（グリッサンド用）
  // 複数タッチ対応：各タッチポイントのIDとMIDIノートのマッピング
  const activeTouchesRef = useRef<Map<number, number>>(new Map()); // touch.identifier -> midi
  const [screenDimensions, setScreenDimensions] = useState(Dimensions.get('window'));
  // 安全機構：最後のタッチイベント時刻を記録
  const lastTouchTimeRef = useRef<number>(0);
  const isTouchActiveRef = useRef<boolean>(false);

  // 画面サイズ変更を監視
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenDimensions(window);
      // 画面サイズが変わったらレイアウトをリセット（再測定させる）
      setLayout(null);
    });
    return () => subscription.remove();
  }, []);

  // 安全機構：タッチがないのに音が残っている場合は強制停止（200msごとにチェック）
  useEffect(() => {
    if (holdMode) return; // ホールドモードでは無効

    const checkInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastTouch = now - lastTouchTimeRef.current;
      
      // 最後のタッチから300ms以上経過し、タッチが非アクティブで、音が残っている場合
      if (
        timeSinceLastTouch > 300 &&
        !isTouchActiveRef.current &&
        currentNotesRef.current.size > 0
      ) {
        // すべての音を停止
        currentNotesRef.current.forEach((midi) => {
          onNoteOff(midi);
        });
        currentNotesRef.current.clear();
        activeTouchesRef.current.clear();
        if (onNotesChange) {
          onNotesChange([]);
        }
      }
    }, 200);

    return () => clearInterval(checkInterval);
  }, [holdMode, onNoteOff, onNotesChange]);

  // 鍵盤のレイアウト計算（スマホサイズに最適化）
  const keyboardLayout = useMemo(() => {
    const whiteKeysPerOctave = 7;
    const totalWhiteKeys = whiteKeysPerOctave * octaveCount;
    
    const screenWidth = screenDimensions.width;
    const screenHeight = screenDimensions.height;
    const isLandscape = screenWidth > screenHeight;
    
    // 横幅の計算
    const horizontalPadding = 16;
    const availableWidth = screenWidth - horizontalPadding * 2;
    const whiteKeyWidth = Math.floor(availableWidth / totalWhiteKeys);
    
    // 縦幅の計算（外部からmaxHeightが指定されている場合はそれを優先）
    let availableHeight: number;
    if (maxHeight) {
      // 外部から最大高さが指定されている場合
      availableHeight = maxHeight;
    } else {
      // 従来の計算（フォールバック）
      const reservedHeight = isLandscape 
        ? CONTROL_AREA_HEIGHT + INFO_BAR_HEIGHT + KEYBOARD_PADDING * 2
        : 160;
      availableHeight = screenHeight - reservedHeight;
    }
    
    // 最小高さ: スマホでも押しやすいサイズ（100px）
    // 最大高さ: 指定されたmaxHeightまたは260px
    const minKeyHeight = 100;
    const maxKeyHeightLimit = maxHeight || 260;
    const whiteKeyHeight = Math.max(minKeyHeight, Math.min(maxKeyHeightLimit, availableHeight));
    
    const blackKeyWidth = Math.floor(whiteKeyWidth * 0.65);
    const blackKeyHeight = Math.floor(whiteKeyHeight * 0.6);

    return {
      whiteKeyWidth,
      whiteKeyHeight,
      blackKeyWidth,
      blackKeyHeight,
      totalWhiteKeys,
      totalWidth: whiteKeyWidth * totalWhiteKeys,
    };
  }, [octaveCount, screenDimensions, maxHeight]);

  // 全ての鍵盤データを生成
  const keys = useMemo(() => {
    const result: KeyDefinition[] = [];
    let whiteKeyIndex = 0;

    for (let oct = 0; oct < octaveCount; oct++) {
      const octaveNumber = startOctave + oct;
      const baseMidi = (octaveNumber + 1) * 12; // C0 = 12

      OCTAVE_KEYS.forEach((keyDef) => {
        const midi = baseMidi + OCTAVE_KEYS.indexOf(keyDef);
        result.push({
          note: keyDef.note,
          midi,
          isBlack: keyDef.isBlack,
          position: whiteKeyIndex + keyDef.offset,
        });
        
        if (!keyDef.isBlack && keyDef.note !== 'B') {
          // 白鍵の位置を進める（Bの後は次のオクターブで処理）
        }
      });
      
      whiteKeyIndex += 7;
    }

    return result;
  }, [startOctave, octaveCount]);

  // 座標からMIDIノートを取得（layoutを引数で受け取るバージョン）
  // 当たり判定は描画している鍵盤の四角（totalWidth × whiteKeyHeight）に合わせる
  const getMidiFromPositionWithLayout = useCallback((x: number, y: number, currentLayout: { x: number; y: number; width: number; height: number }): number | null => {
    const { whiteKeyWidth, whiteKeyHeight, blackKeyWidth, blackKeyHeight, totalWidth } = keyboardLayout;
    // タッチ座標をコンテナの相対座標に変換（コンテナ左上は layout.x, layout.y）
    const relativeX = x - currentLayout.x;
    const relativeY = y - currentLayout.y;

    // 下側の端が反応しにくいため、当たり判定を下まで十分広げる（白鍵高さの約10%＋24px）
    const hitHeight = whiteKeyHeight + Math.max(24, Math.floor(whiteKeyHeight * 0.1));

    // 範囲外チェック：描画サイズ（鍵盤の四角）に合わせて判定
    if (relativeX < 0 || relativeX > totalWidth) return null;
    if (relativeY < 0 || relativeY > hitHeight) return null;

    // まず黒鍵をチェック（上にあるため、より優先）
    // 黒鍵の高さ全体でタッチできるようにする（relativeY < blackKeyHeight の条件を緩和）
    // 黒鍵の高さは白鍵の60%程度なので、その範囲全体でタッチ可能にする
    if (relativeY < blackKeyHeight * 1.2) { // 少し余裕を持たせる
      for (const key of keys) {
        if (!key.isBlack) continue;

        // レンダリング位置と一致させる: (key.position + 1) * whiteKeyWidth - blackKeyWidth / 2
        const blackKeyX = (key.position + 1) * whiteKeyWidth - blackKeyWidth / 2;
        
        // 黒鍵の範囲をチェック（左右の余裕を広げる）
        if (relativeX >= blackKeyX - 5 && relativeX <= blackKeyX + blackKeyWidth + 5) {
          return key.midi;
        }
      }
    }

    // 白鍵をチェック
    const adjustedX = relativeX - 1;
    if (adjustedX < 0) return null;
    
    const whiteKeyIndex = Math.floor(adjustedX / whiteKeyWidth);
    const whiteKeys = keys.filter((k) => !k.isBlack);
    if (whiteKeyIndex >= 0 && whiteKeyIndex < whiteKeys.length) {
      return whiteKeys[whiteKeyIndex].midi;
    }

    return null;
  }, [keys, keyboardLayout]);

  // 座標からMIDIノートを取得
  const getMidiFromPosition = useCallback((x: number, y: number): number | null => {
    if (!layout) return null;
    return getMidiFromPositionWithLayout(x, y, layout);
  }, [getMidiFromPositionWithLayout, layout]);

  // タッチ処理（複数タッチ対応）
  const handleTouchStart = useCallback((midi: number, touchId?: number) => {
    // ホールドモードで既に鳴っている音をタップした場合は解除
    if (holdMode && activeNotes.has(midi)) {
      onNoteOff(midi);
      currentNotesRef.current.delete(midi);
      if (touchId !== undefined) {
        activeTouchesRef.current.delete(touchId);
      }
      return;
    }
    
    // 既に鳴っている音は停止しない（複数音同時押し対応）
    // ただし、同じMIDIノートが既に鳴っている場合は追加しない
    if (!currentNotesRef.current.has(midi)) {
      currentNotesRef.current.add(midi);
      if (touchId !== undefined) {
        activeTouchesRef.current.set(touchId, midi);
      }
      lastNoteRef.current = midi;
      onNoteOn(midi);
    }
  }, [holdMode, activeNotes, onNoteOn, onNoteOff]);

  // 特定のタッチポイントを終了
  const handleTouchEnd = useCallback((touchId?: number) => {
    if (!holdMode) {
      if (touchId !== undefined) {
        // 特定のタッチポイントを終了
        const midi = activeTouchesRef.current.get(touchId);
        if (midi !== undefined) {
          onNoteOff(midi);
          currentNotesRef.current.delete(midi);
          activeTouchesRef.current.delete(touchId);
        }
      } else {
        // すべてのタッチポイントを終了（フォールバック）
        const notesToStop = new Set(currentNotesRef.current);
        currentNotesRef.current.clear();
        activeTouchesRef.current.clear();
        notesToStop.forEach((midi) => {
          onNoteOff(midi);
        });
        lastNoteRef.current = null;
      }
      
      if (onNotesChange) {
        onNotesChange(Array.from(currentNotesRef.current));
      }
    }
  }, [holdMode, onNoteOff, onNotesChange]);

  // タッチ移動処理（複数タッチ対応）
  const handleTouchMove = useCallback((x: number, y: number, touchId?: number) => {
    const midi = getMidiFromPosition(x, y);
    
    if (!holdMode) {
      if (touchId !== undefined) {
        // 特定のタッチポイントが移動したとき
        const previousMidi = activeTouchesRef.current.get(touchId);
        
        if (midi !== null && midi !== previousMidi) {
          // 新しい鍵に移動したとき
          if (previousMidi !== undefined) {
            // 前の音を停止
            onNoteOff(previousMidi);
            currentNotesRef.current.delete(previousMidi);
          }
          
          // 新しい音を鳴らす（既に鳴っている場合は追加しない）
          if (!currentNotesRef.current.has(midi)) {
            currentNotesRef.current.add(midi);
            onNoteOn(midi);
          }
          activeTouchesRef.current.set(touchId, midi);
          lastNoteRef.current = midi;
        } else if (midi === null && previousMidi !== undefined) {
          // 鍵盤の外に出たとき
          onNoteOff(previousMidi);
          currentNotesRef.current.delete(previousMidi);
          activeTouchesRef.current.delete(touchId);
        }
        
        if (onNotesChange) {
          onNotesChange(Array.from(currentNotesRef.current));
        }
      } else {
        // フォールバック：単一タッチポイントの場合（後方互換性）
        if (midi !== null && midi !== lastNoteRef.current) {
          const notesToStop = new Set(currentNotesRef.current);
          notesToStop.forEach((existingMidi) => {
            onNoteOff(existingMidi);
          });
          currentNotesRef.current.clear();
          currentNotesRef.current.add(midi);
          onNoteOn(midi);
          lastNoteRef.current = midi;
          if (onNotesChange) {
            onNotesChange([midi]);
          }
        } else if (midi === null) {
          const notesToStop = new Set(currentNotesRef.current);
          currentNotesRef.current.clear();
          notesToStop.forEach((existingMidi) => {
            onNoteOff(existingMidi);
          });
          lastNoteRef.current = null;
          if (onNotesChange) {
            onNotesChange([]);
          }
        }
      }
    } else {
      // ホールドモードの場合
      if (touchId !== undefined) {
        const previousMidi = activeTouchesRef.current.get(touchId);
        if (midi !== null && midi !== previousMidi) {
          if (!currentNotesRef.current.has(midi)) {
            currentNotesRef.current.add(midi);
            onNoteOn(midi);
          }
          activeTouchesRef.current.set(touchId, midi);
          lastNoteRef.current = midi;
          if (onNotesChange) {
            onNotesChange(Array.from(currentNotesRef.current));
          }
        } else if (midi === null && previousMidi !== undefined) {
          onNoteOff(previousMidi);
          currentNotesRef.current.delete(previousMidi);
          activeTouchesRef.current.delete(touchId);
          if (onNotesChange) {
            onNotesChange(Array.from(currentNotesRef.current));
          }
        }
      }
    }
  }, [getMidiFromPosition, holdMode, onNoteOn, onNoteOff, onNotesChange]);

  // ホールドでないとき用の共通処理：今触れている鍵盤の音だけ鳴らすように同期
  const syncNotesWithTouches = useCallback((touches: any[]) => {
    // タッチ状態を更新
    lastTouchTimeRef.current = Date.now();
    isTouchActiveRef.current = touches.length > 0;

    // 目標：今触れている鍵盤のMIDIセット
    const targetMidis = new Set<number>();
    touches.forEach((touch: any) => {
      const { pageX, pageY } = touch;
      const midi = getMidiFromPosition(pageX, pageY);
      if (midi !== null) {
        targetMidis.add(midi);
      }
    });
    // 今鳴っているが触れていない音を止める
    currentNotesRef.current.forEach((midi) => {
      if (!targetMidis.has(midi)) {
        onNoteOff(midi);
      }
    });
    // 触れているがまだ鳴っていない音を鳴らす
    targetMidis.forEach((midi) => {
      if (!currentNotesRef.current.has(midi)) {
        onNoteOn(midi);
      }
    });
    // 状態を更新（Setは参照を新しく作る）
    currentNotesRef.current = new Set(targetMidis);
    activeTouchesRef.current.clear();
    lastNoteRef.current = targetMidis.size > 0 ? Math.max(...targetMidis) : null;
    if (onNotesChange) {
      onNotesChange(Array.from(targetMidis));
    }
  }, [getMidiFromPosition, onNoteOff, onNoteOn, onNotesChange]);

  // PanResponder設定（複数タッチ対応）
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      // layoutがなければ測定を試みる（次のタッチで有効になる）
      if (!layout) {
        containerRef.current?.measureInWindow((x, y, width, height) => {
          if (width > 0 && height > 0) {
            setLayout({ x, y, width, height });
          }
        });
        return;
      }
      
      const touches = evt.nativeEvent.touches || [evt.nativeEvent];
      if (!holdMode) {
        // ホールドでないときは「今触れている鍵盤の音だけ」に同期
        syncNotesWithTouches(touches);
      } else {
        // ホールドモード：複数タッチ対応
        touches.forEach((touch: any) => {
          const touchId = touch.identifier !== undefined ? touch.identifier : touch.pageX * 1000 + touch.pageY;
          const { pageX, pageY } = touch;
          const midi = getMidiFromPosition(pageX, pageY);
          if (midi !== null) {
            handleTouchStart(midi, touchId);
          }
        });
      }
    },
    onPanResponderMove: (evt) => {
      if (!layout) return;
      
      const touches = evt.nativeEvent.touches || [];
      if (!holdMode) {
        // ホールドでないときは「今触れている鍵盤の音だけ」に同期
        syncNotesWithTouches(touches);
      } else {
        // ホールドモード
        const currentTouchIds = new Set(
          touches.map((t: any) => t.identifier !== undefined ? t.identifier : t.pageX * 1000 + t.pageY)
        );
        touches.forEach((touch: any) => {
          const touchId = touch.identifier !== undefined ? touch.identifier : touch.pageX * 1000 + touch.pageY;
          const { pageX, pageY } = touch;
          handleTouchMove(pageX, pageY, touchId);
        });
        const releasedTouches: number[] = [];
        activeTouchesRef.current.forEach((midi, touchId) => {
          if (!currentTouchIds.has(touchId)) {
            releasedTouches.push(touchId);
          }
        });
        releasedTouches.forEach((touchId) => {
          handleTouchEnd(touchId);
        });
      }
    },
    onPanResponderRelease: (evt) => {
      const touches = evt.nativeEvent.touches || [];
      if (!holdMode) {
        // ホールドでないときは「今触れている鍵盤の音だけ」に同期（0本なら全音停止）
        syncNotesWithTouches(touches);
      } else {
        // ホールドモード
        if (touches.length === 0) {
          handleTouchEnd();
        } else {
          const currentTouchIds = new Set(
            touches.map((t: any) => t.identifier !== undefined ? t.identifier : t.pageX * 1000 + t.pageY)
          );
          const releasedTouches: number[] = [];
          activeTouchesRef.current.forEach((midi, touchId) => {
            if (!currentTouchIds.has(touchId)) {
              releasedTouches.push(touchId);
            }
          });
          releasedTouches.forEach((touchId) => {
            handleTouchEnd(touchId);
          });
        }
      }
    },
    onPanResponderTerminate: (evt) => {
      // タッチが中断された場合も確実にすべての音を停止
      if (!holdMode) {
        syncNotesWithTouches([]);
      } else {
        handleTouchEnd();
      }
    },
  }), [layout, getMidiFromPosition, handleTouchStart, handleTouchMove, handleTouchEnd, holdMode, syncNotesWithTouches]);

  // レイアウト測定関数
  const measureLayoutNow = useCallback(() => {
    containerRef.current?.measureInWindow((x, y, w, h) => {
      if (w > 0 && h > 0) {
        setLayout({ x, y, width: w, height: h });
      }
    });
  }, []);

  // コンポーネントマウント時にも測定を試行（複数回）
  useEffect(() => {
    // 複数のタイミングで測定を試みる（確実性のため）
    const timers = [
      setTimeout(measureLayoutNow, 100),
      setTimeout(measureLayoutNow, 300),
      setTimeout(measureLayoutNow, 500),
    ];
    return () => timers.forEach(clearTimeout);
  }, [measureLayoutNow]);

  // レイアウト変更時に測定
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    // 即座に測定を試みる
    measureLayoutNow();
    // 少し遅延してから再測定（レイアウト完了を待つ）
    setTimeout(measureLayoutNow, 50);
  }, [measureLayoutNow]);

  const { whiteKeyWidth, whiteKeyHeight, blackKeyWidth, blackKeyHeight, totalWidth } = keyboardLayout;
  const whiteKeys = keys.filter((k) => !k.isBlack);
  const blackKeys = keys.filter((k) => k.isBlack);

  return (
    <View
      ref={containerRef}
      style={[styles.container, { width: totalWidth, height: whiteKeyHeight }]}
      onLayout={onLayout}
      {...panResponder.panHandlers}
    >
      {/* 白鍵 */}
      <View style={styles.whiteKeysContainer}>
        {whiteKeys.map((key, index) => (
          <View
            key={key.midi}
            style={[
              styles.whiteKey,
              {
                width: whiteKeyWidth - 2,
                height: whiteKeyHeight,
              },
              activeNotes.has(key.midi) && styles.whiteKeyActive,
            ]}
          >
            {/* 音名ラベル（最初のオクターブのみ） */}
            {index < 7 && (
              <View style={styles.keyLabel}>
                <View style={[
                  styles.keyLabelText,
                  activeNotes.has(key.midi) && styles.keyLabelTextActive,
                ]} />
              </View>
            )}
          </View>
        ))}
      </View>

      {/* 黒鍵 */}
      <View style={styles.blackKeysContainer}>
        {blackKeys.map((key) => {
          const leftPosition = (key.position + 1) * whiteKeyWidth - blackKeyWidth / 2;
          return (
            <View
              key={key.midi}
              style={[
                styles.blackKey,
                {
                  width: blackKeyWidth,
                  height: blackKeyHeight,
                  left: leftPosition,
                },
                activeNotes.has(key.midi) && styles.blackKeyActive,
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  whiteKeysContainer: {
    flexDirection: 'row',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  whiteKey: {
    backgroundColor: colors.keyboard.white,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 0,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    marginHorizontal: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 8,
    // 影
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  whiteKeyActive: {
    backgroundColor: colors.keyboard.whitePressed,
    shadowOpacity: 0,
    elevation: 0,
  },
  blackKeysContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  blackKey: {
    position: 'absolute',
    backgroundColor: colors.keyboard.black,
    borderRadius: 0,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    // 影
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  blackKeyActive: {
    backgroundColor: colors.keyboard.blackPressed,
    shadowOpacity: 0.1,
    elevation: 2,
  },
  keyLabel: {
    position: 'absolute',
    bottom: 8,
  },
  keyLabelText: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ddd',
  },
  keyLabelTextActive: {
    backgroundColor: colors.accent.primary,
  },
});
