import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone", // gera build enxuto para Docker
  reactCompiler: false, // desativado: pode causar carregamento infinito em alguns ambientes
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/dashboard/default",
        permanent: false,
      },
    ];
  },
};

// Só tenta upload de source maps quando há token (evita 401 no deploy sem SENTRY_AUTH_TOKEN)
const hasSentryAuth = Boolean(process.env.SENTRY_AUTH_TOKEN);

export default withBundleAnalyzer(
  withSentryConfig(nextConfig, {
    org: process.env.SENTRY_ORG ?? "completepay",
    project: process.env.SENTRY_PROJECT ?? "saas-frontend",
    silent: !process.env.CI,
    widenClientFileUpload: true,
    sourcemaps: {
      disable: !hasSentryAuth,
    },
    release: {
      create: hasSentryAuth,
    },
  })
);
