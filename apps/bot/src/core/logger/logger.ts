/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : logger.ts
 * Purpose : Central logging service
 * =========================================================
 */

import chalk from "chalk";

type ChalkColor = (text: string) => string;

export class Logger {
  private static time(): string {
    return new Date().toLocaleTimeString("en-IN", {
      hour12: false,
    });
  }

  private static log(
    level: string,
    color: ChalkColor,
    message: string,
  ): void {
    console.log(
      `${color(level.padEnd(9))} ${chalk.gray(this.time())} ${message}`,
    );
  }

  public static info(message: string): void {
    this.log("[INFO]", chalk.blue, message);
  }

  public static success(message: string): void {
    this.log("[SUCCESS]", chalk.green, message);
  }

  public static warn(message: string): void {
    this.log("[WARNING]", chalk.yellow, message);
  }

  public static error(message: string): void {
    this.log("[ERROR]", chalk.red, message);
  }

  public static debug(message: string): void {
    this.log("[DEBUG]", chalk.magenta, message);
  }
}