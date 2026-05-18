import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sparkmark.pomodoro',
  appName: 'Pomodoro',
  webDir: 'public',
  server: {
    url: 'https://pomodoro-app-mu-hazel.vercel.app',
  },
  ios: {
    contentInset: 'never',
  },
};

export default config;
