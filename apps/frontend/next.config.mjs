import { withSentryConfig } from "@sentry/nextjs";

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

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? "completepay",
  project: process.env.SENTRY_PROJECT ?? "saas-frontend",
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
