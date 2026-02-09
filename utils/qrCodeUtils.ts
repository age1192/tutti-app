/**
 * QRコードユーティリティ
 * プログラムのエクスポート・インポート用
 */
import { Program } from '../types';

/**
 * プログラムをJSON文字列にエンコード
 */
export function encodeProgram(program: Program): string {
  return JSON.stringify(program);
}

/**
 * JSON文字列からプログラムをデコード
 */
export function decodeProgram(jsonString: string): Program | null {
  try {
    const program = JSON.parse(jsonString);
    // バリデーション
    if (program.id && program.name && program.sections && Array.isArray(program.sections)) {
      return program as Program;
    }
    return null;
  } catch (error) {
    console.error('Failed to decode program:', error);
    return null;
  }
}

/**
 * UTF-8文字列をBase64エンコード（Unicode対応）
 */
function utf8ToBase64(str: string): string {
  if (typeof btoa !== 'undefined') {
    // ブラウザ環境: UTF-8エンコードしてからBase64
    const utf8Bytes = new TextEncoder().encode(str);
    const binaryString = Array.from(utf8Bytes, byte => String.fromCharCode(byte)).join('');
    return btoa(binaryString);
  }
  // Node.js環境
  return Buffer.from(str, 'utf-8').toString('base64');
}

/**
 * Base64をUTF-8文字列にデコード（Unicode対応）
 */
function base64ToUtf8(base64: string): string {
  if (typeof atob !== 'undefined') {
    // ブラウザ環境: Base64デコードしてからUTF-8デコード
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }
  // Node.js環境
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * プログラムをBase64エンコード（QRコード用に圧縮）
 */
export function encodeProgramBase64(program: Program): string {
  const json = encodeProgram(program);
  return utf8ToBase64(json);
}

/**
 * Base64からプログラムをデコード
 */
export function decodeProgramBase64(base64String: string): Program | null {
  try {
    const json = base64ToUtf8(base64String);
    return decodeProgram(json);
  } catch (error) {
    console.error('Failed to decode program from base64:', error);
    return null;
  }
}
