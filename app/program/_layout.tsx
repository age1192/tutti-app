import { Stack } from 'expo-router';
import { colors } from '../../styles';

export default function ProgramLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background.primary,
        },
        headerTintColor: colors.text.primary,
        headerTitleStyle: {
          fontWeight: '600',
        },
        contentStyle: {
          backgroundColor: colors.background.primary,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'プログラムメトロノーム',
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'プログラム編集',
        }}
      />
      <Stack.Screen
        name="play"
        options={{
          title: 'プログラム再生',
        }}
      />
    </Stack>
  );
}
