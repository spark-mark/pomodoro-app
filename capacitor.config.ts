import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.NODE_ENV !== 'production';

const config: CapacitorConfig = {
  appId: 'com.sparkmark.pomodoro',
  appName: 'Pomodoro',
  webDir: 'public',
  server: {
    url: isDev ? 'http://192.168.2.201:3000' : 'https://pomodoro-app-mu-hazel.vercel.app',
    cleartext: isDev,
  },
  ios: {
    contentInset: 'never',
  },
};

export default config;
