import dotenv from "dotenv";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

export const logger = {
  info(message: string, meta?: any) {
    log("INFO", message, meta);
  },
  warn(message: string, meta?: any) {
    log("WARN", message, meta);
  },
  error(message: string, error?: any, meta?: any) {
    let mergedMeta = meta || {};
    if (error) {
      mergedMeta.error = error instanceof Error 
        ? { message: error.message, stack: error.stack } 
        : error;
    }
    log("ERROR", message, mergedMeta);
  },
  debug(message: string, meta?: any) {
    if (process.env.NODE_ENV !== "production") {
      log("DEBUG", message, meta);
    }
  }
};

function log(level: "INFO" | "WARN" | "ERROR" | "DEBUG", message: string, meta?: any) {
  const timestamp = new Date().toISOString();
  
  if (isProduction) {
    // Structured JSON log format for production
    console.log(JSON.stringify({
      timestamp,
      level,
      message,
      ...(meta || {})
    }));
  } else {
    // Colored human-readable log format for development
    let color = "\x1b[0m"; // Reset
    switch (level) {
      case "INFO":
        color = "\x1b[36m"; // Cyan
        break;
      case "WARN":
        color = "\x1b[33m"; // Yellow
        break;
      case "ERROR":
        color = "\x1b[31m"; // Red
        break;
      case "DEBUG":
        color = "\x1b[90m"; // Gray
        break;
    }
    
    console.log(
      `${color}[${timestamp}] [${level}]\x1b[0m ${message}`,
      meta ? `\n\x1b[90m${JSON.stringify(meta, null, 2)}\x1b[0m` : ""
    );
  }
}
