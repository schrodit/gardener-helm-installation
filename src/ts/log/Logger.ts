import {Logger as wLogger, createLogger as createWLogger, config, transports, format} from 'winston';
import {deepMergeObject} from '../utils/deepMerge';

export enum LogLevel {
    INFO = 'info',
    ERROR = 'error',
}

class LogCollector {
    private level: LogLevel = LogLevel.INFO;
    public logger!: wLogger;

    constructor() {
        this.setLogger();
    }

    public setLevel(level: LogLevel) {
        this.level = level;
        this.setLogger();
    }

    private setLogger() {
        this.logger = createWLogger(
            {
                levels: config.cli.levels,
                level: this.level,
                format: format.cli(),
                transports: [
                    new transports.Console(),
                ],
            }
        );
    }

}

const logCollector = new LogCollector();

export type Labels = Record<string, any>

export class Logger {

    constructor(
        private readonly collector: LogCollector,
        private readonly labels?: Labels,
    ) {}

    public info(msg: string, labels?: Labels) {
        this.log(LogLevel.INFO, msg, labels);
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
