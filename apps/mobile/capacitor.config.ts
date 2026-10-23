import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.footlab.app', appName: 'FOOTLAB', webDir: 'dist',
  android: { backgroundColor: '#0b1115' },
  server: { androidScheme: 'https', cleartext: process.env.FOOTLAB_DEBUG_HTTP === '1' },
};
export default config;
