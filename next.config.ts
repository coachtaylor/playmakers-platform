import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  experimental: {
    // The player profile step posts a headshot through a Server Action, and the
    // default body cap is 1 MB — smaller than a phone photo. The form itself holds
    // files to 8 MB, so this leaves room for the rest of the fields.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;

// Lets `next dev` use Cloudflare bindings locally. No effect on production builds.
initOpenNextCloudflareForDev();
