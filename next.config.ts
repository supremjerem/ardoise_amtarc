import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  /*
   * Emits a self-contained server in .next/standalone. Unused on Vercel, but
   * it is what allows moving to a VPS or a Docker container without a
   * rewrite — the portability promised in the plan.
   */
  output: "standalone",
  /*
   * @node-rs/argon2 is a native module: it must stay external to the server
   * bundle, otherwise the binary is not resolved at runtime.
   */
  serverExternalPackages: ["@node-rs/argon2"],
};

export default nextConfig;
