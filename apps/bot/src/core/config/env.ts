/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : env.ts
 * Purpose : Centralized environment configuration.
 * =========================================================
 */

import "dotenv/config";

export class Env {
  public static readonly DISCORD_TOKEN =
    process.env.DISCORD_TOKEN ?? "";

  public static readonly CLIENT_ID =
    process.env.CLIENT_ID ?? "";

  public static readonly NODE_ENV =
    process.env.NODE_ENV ?? "development";

  public static validate(): void {
    const missing: string[] = [];

    if (!this.DISCORD_TOKEN) {
      missing.push("DISCORD_TOKEN");
    }

    if (!this.CLIENT_ID) {
      missing.push("CLIENT_ID");
    }

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(", ")}`
      );
    }
  }
}