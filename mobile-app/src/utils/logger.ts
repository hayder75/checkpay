/**
 * Enhanced Logger with log clearing and better formatting
 * Clears old logs when new session starts
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
}

class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogs = 200; // Keep last 200 logs
  private sessionStartTime = Date.now();
  private categories: Set<string> = new Set();
  private cleared = false; // Track if we've cleared console

  private constructor() {
    // Don't clear console in constructor - do it lazily on first log
    // This avoids issues with module initialization order
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatMessage(level: LogLevel, category: string, message: string, data?: any): string {
    const emoji = {
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
      debug: '🔍',
      success: '✅',
    }[level];

    const color = {
      info: '\x1b[36m', // Cyan
      warn: '\x1b[33m', // Yellow
      error: '\x1b[31m', // Red
      debug: '\x1b[35m', // Magenta
      success: '\x1b[32m', // Green
    }[level];

    const reset = '\x1b[0m';
    const timestamp = new Date().toLocaleTimeString();
    
    return `${color}${emoji} [${timestamp}] [${category}] ${message}${reset}`;
  }

  private addLog(level: LogLevel, category: string, message: string, data?: any): void {
    // Clear console on first log (lazy initialization)
    if (!this.cleared) {
      try {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.clear();
          console.log('🚀 [Logger] New session started');
        }
      } catch (e) {
        // Ignore if __DEV__ is not available
      }
      this.cleared = true;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
    };

    this.logs.push(entry);
    this.categories.add(category);

    // Keep only last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  info(category: string, message: string, data?: any): void {
    this.addLog('info', category, message, data);
    const formatted = this.formatMessage('info', category, message);
    console.log(formatted, data || '');
  }

  warn(category: string, message: string, data?: any): void {
    this.addLog('warn', category, message, data);
    const formatted = this.formatMessage('warn', category, message);
    console.warn(formatted, data || '');
  }

  error(category: string, message: string, data?: any): void {
    this.addLog('error', category, message, data);
    const formatted = this.formatMessage('error', category, message);
    console.error(formatted, data || '');
  }

  debug(category: string, message: string, data?: any): void {
    try {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        this.addLog('debug', category, message, data);
        const formatted = this.formatMessage('debug', category, message);
        console.log(formatted, data || '');
      }
    } catch (e) {
      // Fallback to regular console.log if __DEV__ check fails
      this.addLog('debug', category, message, data);
      const formatted = this.formatMessage('debug', category, message);
      console.log(formatted, data || '');
    }
  }

  success(category: string, message: string, data?: any): void {
    this.addLog('success', category, message, data);
    const formatted = this.formatMessage('success', category, message);
    console.log(formatted, data || '');
  }

  // Clear logs (useful for testing)
  clear(): void {
    this.logs = [];
    try {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.clear();
        console.log('🧹 [Logger] Logs cleared');
      }
    } catch (e) {
      // Ignore if __DEV__ is not available
    }
  }

  // Get logs for debugging
  getLogs(category?: string): LogEntry[] {
    if (category) {
      return this.logs.filter(log => log.category === category);
    }
    return [...this.logs];
  }

  // Get summary
  getSummary(): { total: number; byCategory: Record<string, number>; byLevel: Record<string, number> } {
    const byCategory: Record<string, number> = {};
    const byLevel: Record<string, number> = {};

    this.logs.forEach(log => {
      byCategory[log.category] = (byCategory[log.category] || 0) + 1;
      byLevel[log.level] = (byLevel[log.level] || 0) + 1;
    });

    return {
      total: this.logs.length,
      byCategory,
      byLevel,
    };
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export convenience functions
export const log = {
  info: (category: string, message: string, data?: any) => logger.info(category, message, data),
  warn: (category: string, message: string, data?: any) => logger.warn(category, message, data),
  error: (category: string, message: string, data?: any) => logger.error(category, message, data),
  debug: (category: string, message: string, data?: any) => logger.debug(category, message, data),
  success: (category: string, message: string, data?: any) => logger.success(category, message, data),
};

export default logger;

