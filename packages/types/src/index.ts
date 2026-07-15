/**
 * ---------------------------------------------------------
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Package: @nexus/types
 * Description: Shared platform types.
 * ---------------------------------------------------------
 */

export interface VersionInfo {
  major: number;
  minor: number;
  patch: number;
}

export interface PackageInfo {
  name: string;
  version: string;
}

export interface HealthStatus {
  status: "online" | "offline";
  timestamp: Date;
}