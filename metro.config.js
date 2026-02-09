// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// expo-router用の設定
config.resolver.sourceExts.push('tsx', 'ts', 'jsx', 'js', 'json', 'mjs');

module.exports = config;
