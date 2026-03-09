// ---------------------------------------------------------------------------
// Langfuse singleton — reused across the server process lifetime
// ---------------------------------------------------------------------------

import { Langfuse } from "langfuse";

let instance: Langfuse | null = null;

export function getLangfuse(): Langfuse {
  if (!instance) {
    instance = new Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
      secretKey: process.env.LANGFUSE_SECRET_KEY!,
      baseUrl: process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
    });
  }
  return instance;
}
