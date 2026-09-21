// Cloudflare adapter config. Every page in this app is rendered per request, so no
// incremental cache (R2) is configured; add one if static pages are introduced.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
