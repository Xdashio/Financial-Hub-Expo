// app.config.js
// Converted from app.json so we can conditionally restrict the Android
// native architectures for the "preview-arm64" EAS build profile only.
// Production keeps building for all architectures (app-bundle already lets
// Google Play do per-device splitting, so there's no APK bloat there).

// NOTE: do NOT use an "EAS_BUILD_" prefix for custom env vars — that prefix
// is reserved by EAS Build for its own internal build metadata
// (EAS_BUILD_PROFILE, EAS_BUILD_PLATFORM, etc). Custom vars with that
// prefix get silently dropped, which is why arm64-only restriction was
// never actually applied.
const arm64Only = process.env.ARM64_ONLY_BUILD === "true";

module.exports = {
  expo: {
    name: "Financial Hub",
    slug: "financial-hub-mobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    platforms: ["ios", "android", "web"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.financialhub.mobile",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#F6F7F2",
        foregroundImage: "./assets/icon.png",
        monochromeImage: "./assets/icon.png",
      },
      predictiveBackGestureEnabled: false,
      package: "com.financialhub.mobile",
      enableProguardInReleaseBuilds: true,
    },
    web: {
      bundler: "metro",
      favicon: "./assets/icon.png",
      config: "./web.config.js",
      meta: {
        viewport: {
          width: "device-width",
          "initial-scale": 1,
          "maximum-scale": 1,
          "user-scalable": "no",
        },
      },
    },
    experiments: {
      typedRoutes: true,
    },
    plugins: [
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon.png",
          imageWidth: 260,
          resizeMode: "contain",
          backgroundColor: "#F6F7F2",
        },
      ],
      [
        "expo-router",
        {
          unstable_useServerMiddleware: false,
        },
      ],
      "expo-font",
      [
        "expo-notifications",
        {
          color: "#0F6E56",
          defaultChannel: "financial-hub-default",
        },
      ],
      "@sentry/react-native",
      [
        "expo-build-properties",
        {
          android: {
            enableProguardInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
            // Only restrict native architectures for the arm64-only preview
            // profile (see eas.json -> preview-arm64 -> env.EAS_BUILD_ARM64_ONLY).
            // Restricting this for production would break users on
            // armeabi-v7a devices and x86 emulators.
            ...(arm64Only ? { reactNativeArchitectures: ["arm64-v8a"] } : {}),
          },
        },
      ],
    ],
    scheme: "financialhub",
    extra: {
      eas: {
        projectId: "4e053d97-d6cb-4662-8fe5-faa1767e47cc",
      },
      sentryDsn: "",
      router: {
        unstable_useServerMiddleware: false,
      },
    },
    owner: "lululug",
  },
};