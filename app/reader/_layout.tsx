import { Stack } from 'expo-router';

export default function ReaderLayout() {
  return (
    <Stack>
      <Stack.Screen name="[storyId]" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
    </Stack>
  );
}
