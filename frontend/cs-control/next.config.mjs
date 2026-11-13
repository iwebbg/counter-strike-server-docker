/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    useTypeScriptCli: false,
  },
  typescript: {
    ignoreBuildErrors: process.env.NEXT_SKIP_INTERNAL_TYPECHECK === "true",
  },
};

export default nextConfig;
