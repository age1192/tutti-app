import { Redirect } from 'expo-router';

export default function Index() {
  // 一時的に直接ホームにリダイレクト（エラー切り分けのため）
  return <Redirect href="/home" />;
}
