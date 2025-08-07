const CONFIG = {
    userLogin: 'Zackrmt',
    startTime: '2025-08-07 13:26:20',
    timeZone: 'UTC',
    debug: {
        enabled: true,
        logLevel: 'INFO', // 'ERROR', 'WARN', 'INFO', 'DEBUG'
        maxLogs: 1000,
        logToStorage: true,
        logToConsole: true
    }
};

class DebugLogger {
    constructor() {
        this.logLevels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3
        };
        this.logs = [];
        this.initialize();
    }

    async initialize() {
        try {
            if (CONFIG.debug.logToStorage) {
                const { debugLogs } = await chrome.storage.local.get('debugLogs');
                if (debugLogs) {
                    this.logs = debugLogs;
                }
            }
        } catch (error) {
            console.error('Failed to initialize debug logger:', error);
        }
    }

    shouldLog(level) {
        return CONFIG.debug.enabled && 
               this.logLevels[level] <= this.logLevels[CONFIG.debug.logLevel];
    }

    async saveLog(logEntry) {
        if (!CONFIG.debug.logToStorage) return;

        try {
            this.logs.push(logEntry);
            
            // Keep only last maxLogs entries
            if (this.logs.length > CONFIG.debug.maxLogs) {
                this.logs = this.logs.slice(-CONFIG.debug.maxLogs);
            }

            await chrome.storage.local.set({ debugLogs: this.logs });
        } catch (error) {
            console.error('Failed to save log:', error);
        }
    }

    formatLogMessage(level, message, data) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data: data || null,
            user: CONFIG.userLogin
        };

        return {
            formatted: `[${timestamp}] [${level}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}`,
            entry: logEntry
        };
    }

    log(level, message, data) {
        if (!this.shouldLog(level)) return;

        const { formatted, entry } = this.formatLogMessage(level, message, data);

        if (CONFIG.debug.logToConsole) {
            switch (level) {
                case 'ERROR':
                    console.error(formatted);
                    break;
                case 'WARN':
                    console.warn(formatted);
                    break;
                case 'INFO':
                    console.info(formatted);
                    break;
                case 'DEBUG':
                    console.debug(formatted);
                    break;
            }
        }

        this.saveLog(entry);
    }

    error(message, data) {
        this.log('ERROR', message, data);
    }

    warn(message, data) {
        this.log('WARN', message, data);
    }

    info(message, data) {
        this.log('INFO', message, data);
    }

    debug(message, data) {
        this.log('DEBUG', message, data);
    }

    async clearLogs() {
        try {
            this.logs = [];
            await chrome.storage.local.set({ debugLogs: [] });
            this.info('Logs cleared');
        } catch (error) {
            console.error('Failed to clear logs:', error);
        }
    }

    async getLogs(filter = {}) {
        try {
            let filteredLogs = [...this.logs];

            if (filter.level) {
                filteredLogs = filteredLogs.filter(log => log.level === filter.level);
            }

            if (filter.startTime) {
                filteredLogs = filteredLogs.filter(log => 
                    new Date(log.timestamp) >= new Date(filter.startTime)
                );
            }

            if (filter.endTime) {
                filteredLogs = filteredLogs.filter(log => 
                    new Date(log.timestamp) <= new Date(filter.endTime)
                );
            }

            if (filter.search) {
                const searchTerm = filter.search.toLowerCase();
                filteredLogs = filteredLogs.filter(log => 
                    log.message.toLowerCase().includes(searchTerm) ||
                    (log.data && JSON.stringify(log.data).toLowerCase().includes(searchTerm))
                );
            }

            return filteredLogs;
        } catch (error) {
            console.error('Failed to get logs:', error);
            return [];
        }
    }

    async exportLogs(format = 'json') {
        try {
            const logs = await this.getLogs();
            
            switch (format.toLowerCase()) {
                case 'json':
                    return JSON.stringify(logs, null, 2);
                
                case 'csv':
                    const headers = ['timestamp', 'level', 'message', 'user', 'data'];
                    const csv = [
                        headers.join(','),
                        ...logs.map(log => [
                            log.timestamp,
                            log.level,
                            `"${log.message.replace(/"/g, '""')}"`,
                            log.user,
                            `"${JSON.stringify(log.data).replace(/"/g, '""')}"`
                        ].join(','))
                    ].join('\n');
                    return csv;
                
                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }
        } catch (error) {
            console.error('Failed to export logs:', error);
            throw error;
        }
    }
}

// Initialize logger
const logger = new DebugLogger();

// Export logger instance
export default logger;

// Example usage:
/*
import logger from './debug.js';

logger.info('Application started', { version: '1.0.0' });
logger.debug('Processing product', { productId: 123 });
logger.warn('Rate limit approaching', { remaining: 10 });
logger.error('Failed to fetch price', { url: 'https://...', error: 'Network error' });

// Get filtered logs
const recentErrors = await logger.getLogs({
    level: 'ERROR',
    startTime: '2025-08-07T00:00:00Z'
});

// Export logs
const jsonLogs = await logger.exportLogs('json');
const csvLogs = await logger.exportLogs('csv');
*/
