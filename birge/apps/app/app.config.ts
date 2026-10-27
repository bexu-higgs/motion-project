import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Құрастыру кезіндегі баптаулар (EAS Build немесе `.env` арқылы):
 *  EXPO_PUBLIC_API_URL    — сервер мекенжайы, мыс. https://birge.kz (вебте бос қалса — сол домен)
 *  BIRGE_IOS_BUNDLE_ID    — App Store Connect-тегі Bundle ID
 *  BIRGE_ANDROID_PACKAGE  — Google Play-дегі package name
 *  BIRGE_DOMAIN           — Universal Links / App Links домені (мыс. birge.kz)
 *  EAS_PROJECT_ID         — `eas init` берген жоба ID-і
 */
const BUNDLE_ID = process.env.BIRGE_IOS_BUNDLE_ID ?? 'kz.birge.app';
const ANDROID_PACKAGE = process.env.BIRGE_ANDROID_PACKAGE ?? 'kz.birge.app';
const DOMAIN = process.env.BIRGE_DOMAIN;
const BACKGROUND = '#0B0D17';

const MIC_TEXT = 'Birge uses the microphone only when you turn it on to talk with people in your room.';
const CAMERA_TEXT = 'Birge does not use the camera. This entry is required by the voice chat library and is never requested.';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Birge',
  slug: 'birge',
  version: '1.0.0',
  scheme: 'birge',
  orientation: 'default',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: BACKGROUND,
  description: 'Watch movies and listen to music together with up to 50 people, with voice and text chat.',
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: true,
    usesAppleSignIn: true,
    associatedDomains: DOMAIN ? [`applinks:${DOMAIN}`] : undefined,
    infoPlist: {
      // Дауыстық чат пен музыка экран құлыпталғанда да үзілмеуі үшін.
      UIBackgroundModes: ['audio'],
      // Тек стандартты HTTPS/WebRTC шифрлауы — экспорттық құжат қажет емес.
      ITSAppUsesNonExemptEncryption: false,
      CFBundleAllowMixedLocalizations: true,
      CFBundleDevelopmentRegion: 'kk',
      NSMicrophoneUsageDescription: MIC_TEXT,
      NSCameraUsageDescription: CAMERA_TEXT,
    },
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeEmailAddress',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePhoneNumber',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeName',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeUserID',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeOtherUserContent',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
      ],
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime', NSPrivacyAccessedAPITypeReasons: ['35F9.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace', NSPrivacyAccessedAPITypeReasons: ['E174.1'] },
      ],
    },
  },
  android: {
    package: ANDROID_PACKAGE,
    adaptiveIcon: {
      backgroundColor: BACKGROUND,
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    permissions: ['android.permission.RECORD_AUDIO', 'android.permission.MODIFY_AUDIO_SETTINGS'],
    // Қолданбайтын рұқсаттар Google Play-де сұралмасын.
    blockedPermissions: [
      'android.permission.CAMERA',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.READ_PHONE_STATE',
    ],
    intentFilters: DOMAIN
      ? [
          {
            action: 'VIEW',
            autoVerify: true,
            data: [{ scheme: 'https', host: DOMAIN, pathPrefix: '/join' }],
            category: ['BROWSABLE', 'DEFAULT'],
          },
        ]
      : undefined,
  },
  web: {
    output: 'single',
    name: 'Birge',
    shortName: 'Birge',
    description: 'Watch together — online cinema with voice and chat',
    themeColor: BACKGROUND,
    backgroundColor: BACKGROUND,
    favicon: './assets/images/favicon.png',
  },
  locales: {
    kk: './locales/kk.json',
    en: './locales/en.json',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: BACKGROUND,
        image: './assets/images/splash-icon.png',
        imageWidth: 120,
      },
    ],
    ['expo-localization', { supportedLocales: { ios: ['kk', 'en'], android: ['kk', 'en'] } }],
    'expo-apple-authentication',
    'expo-web-browser',
    // Сессия токені Keychain/Keystore-да; Face ID қолданылмайды, Android сақтық көшірмесіне түспейді.
    ['expo-secure-store', { faceIDPermission: false, configureAndroidBackup: true }],
    ['expo-video', { supportsBackgroundPlayback: true, supportsPictureInPicture: true }],
    ['@livekit/react-native-expo-plugin', { android: { audioType: 'communication' } }],
    ['@config-plugins/react-native-webrtc', { microphonePermission: MIC_TEXT, cameraPermission: CAMERA_TEXT }],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
  },
});
