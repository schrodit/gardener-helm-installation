import {
    Logger as wLogger,
    createLogger as createWLogger,
    config, transports,
    format as wformat,
} from 'winston';
import {Format} from 'logform';
import {deepMergeObject} from '../utils/deepMerge';

export enum LogLevel {
    INFO = 'info',
    ERROR = 'error',
    DEBUG = 'debug',
}

export enum LogFormat {
    CLI = 'cli',
    JSON = 'json'
}

class LogCollector {
    private level: LogLevel = LogLevel.INFO;
    private format: Format = wformat.cli();
    public logger!: wLogger;

    constructor() {
        this.setLogger();
    }

    public setLevel(level: LogLevel) {
        this.level = level;
        this.setLogger();
    }

    public setFormat(format: LogFormat) {
        switch (format) {
            case LogFormat.CLI:
                this.format = wformat.cli();
                break;
            case LogFormat.JSON:
                this.format = wformat.json();
                break;
        }
        this.setLogger();
    }

    private setLogger() {
        this.logger = createWLogger(
            {
                levels: config.cli.levels,
                level: this.level,
                format: this.format,
                transports: [
                    new transports.Console(),
                ],
            }
        );
    }
}

export const logCollector = new LogCollector();

export type Labels = Record<string, any>

export class Logger {

    constructor(
        private readonly collector: LogCollector,
        private readonly labels?: Labels,
    ) {}

    public info(msg: string, labels?: Labels) {
        this.log(LogLevel.INFO, msg, labels);
    }

    public debug(msg: string, labels?: Labels) {
        this.log(LogLevel.DEBUG, msg, labels);
    }

    public error(msg: string | Error, labels?: Labels) {
        let errMsg = '';
        if (msg instanceof Error) {
            errMsg = `${msg.name}: ${msg.message}`;
        } else {
            errMsg = msg;
        }

        this.log(LogLevel.ERROR, errMsg, labels);
    }

    private log(level: LogLevel, msg: string, labels?: Labels) {
        this.collector.logger.log(level, msg, {
            labels: deepMergeObject(labels, this.labels),
        });
    }
}

export const createLogger = (module: string): Logger => {
    return new Logger(logCollector, {
        module,
    });
};
