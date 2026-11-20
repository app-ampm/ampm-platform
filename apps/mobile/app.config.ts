import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Build variants of the one store app (D-152). app.json describes the store app itself, whose id
 * `com.ampmverse.app` is the iOS bundle identifier and the Android package and never changes once
 * uploaded. A development or preview build adds a suffix to the id and the name, so it installs beside
 * the store app on the same phone.
 *
 * APP_VARIANT comes from the EAS build profiles (eas.json) and the `ios`, `android` and
 * `native:prebuild` scripts. Unset or
 * `production` is the store app, which also covers the web export and `expo start`. This file is
 * Node-run build configuration, like metro.config.js, and never reaches the bundle; the app's runtime
 * configuration stays in src/lib/env.ts (code.md).
 */
const VARIANTS = {
  development: { idSuffix: ".dev", nameSuffix: " Dev" },
  preview: { idSuffix: ".preview", nameSuffix: " Preview" },
} as const;

type Variant = keyof typeof VARIANTS;

function readVariant(value: string | undefined): Variant | "production" {
  if (value === undefined || value === "" || value === "production") return "production";
  if (value === "development" || value === "preview") return value;
  throw new Error(`APP_VARIANT must be development, preview or production, not "${value}"`);
}

function withSuffix(id: string | undefined, suffix: string): string {
  if (!id) throw new Error("app.json must set ios.bundleIdentifier and android.package");
  return `${id}${suffix}`;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const name = config.name ?? "AMPM";
  const slug = config.slug ?? "ampm";
  const variant = readVariant(process.env.APP_VARIANT);
  if (variant === "production") return { ...config, name, slug };

  const { idSuffix, nameSuffix } = VARIANTS[variant];
  return {
    ...config,
    name: `${name}${nameSuffix}`,
    slug,
    ios: { ...config.ios, bundleIdentifier: withSuffix(config.ios?.bundleIdentifier, idSuffix) },
    android: { ...config.android, package: withSuffix(config.android?.package, idSuffix) },
  };
};
