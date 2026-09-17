// app.config.js
// Converted from app.json so we can conditionally restrict the Android
// native architectures for the "preview" EAS build profile only.
// Production keeps building for all architectures (app-bundle already lets
// Google Play do per-device splitting, so there's no APK bloat there).

// NOTE: do NOT use an "EAS_BUILD_" prefix for custom env vars — that prefix
// is reserved by EAS Build for its own internal build metadata
// (EAS_BUILD_PROFILE, EAS_BUILD_PLATFORM, etc). Custom vars with that
// prefix get silently dropped, which is why arm64-only restriction was
// never actually applied.
const arm64Only = process.env.ARM64_ONLY_BUILD === "true";

// M9: one build profile → one backend. The matrix lives in eas.json's
// per-profile `env.EXPO_PUBLIC_API_URL` (mirrored here so `expo start` and
// local builds without EAS env resolve the same backend). Precedence at
// runtime is: EXPO_PUBLIC_API_URL (EAS profile env / .env.local) → profile
// default below → localhost fallback. Non-secret URLs (local/staging/prod
// hosts) live in the repo; real secrets (Sentry DSN, Supabase keys) must
// come from the EAS dashboard environment or .env.local, never eas.json.
const API_URL_BY_PROFILE = {
  development: "http://localhost:3000/api",
  preview: "https://api-staging-f91bc.up.railway.app/api",
  "preview-universal": "https://api-staging-f91bc.up.railway.app/api",
  production: "https://api-production-f91bc.up.railway.app/api",
};
const easProfile = process.env.EAS_BUILD_PROFILE;
const resolvedApiUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  API_URL_BY_PROFILE[easProfile] ||
  "http://localhost:3000/api";

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
      "expo-secure-store",
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
            // R8 + resource shrinking remove unused Java bytecode/resources.
            // These are explicit here so they remain enabled on every
            // release-like EAS profile.
            enableMinifyInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
            // Financial Hub renders only PNG assets at runtime. Removing
            // React Native's unused GIF/WebP decoders reduces Android's
            // native payload without changing image behavior.
            gifEnabled: false,
            webpEnabled: false,
            // Only restrict native architectures for the arm64-only preview
            // profile (see eas.json -> preview -> env.ARM64_ONLY_BUILD).
            // Restricting this for production would break users on
            // armeabi-v7a devices and x86 emulators.
            ...(arm64Only ? {
              buildArchs: ["arm64-v8a"],
              // Smaller direct-download APKs; native libraries are compressed
              // and expanded at install time, trading a little startup speed
              // for less data used by internal testers.
              useLegacyPackaging: true,
              enableBundleCompression: true,
            } : {}),
          },
        },
      ],
    ],
    scheme: "financialhub",
    extra: {
      eas: {
        projectId: "4e053d97-d6cb-4662-8fe5-faa1767e47cc",
      },
      // M9: the backend this build targets, resolved with the same
      // precedence as src/config/api.ts. Lets a Settings/debug screen show
      // "Development → localhost" vs "Preview → staging" vs "Production"
      // without reverse-engineering the bundle.
      apiUrl: resolvedApiUrl,
      easBuildProfile: easProfile || "local",
      sentryDsn: "",
      router: {
        unstable_useServerMiddleware: false,
      },
    },
    owner: "lululug",
  },
};
