import {has} from '@0cfg/utils-common/lib/has';
import {
    milliSecondsInASecond,
    milliSecondsInAMinute,
} from '@0cfg/utils-common/lib/timeSpan';

export interface BackoffConfiguration {
    /**
     * The intial duration in milliseconds before the operation is retried.
     */
    initialDuration: number;
    /**
     * The duration is multiplied by factor each iteration, if factor is not zero
     * and the limits imposed by the maximum duration have not been reached.
     * Should not be negative.
     */
    factor: number;
    /**
     * The maximum time the operation should be retried.
     */
    timeout: number;
    /**
     * The maximum wait time between retries.
     */
    maxDuration?: number;
}

export const defaultBackoff: BackoffConfiguration = {
    initialDuration: 10 * milliSecondsInASecond,
    factor: 1.2,
    timeout: 5 * milliSecondsInAMinute,
    maxDuration: 2 * milliSecondsInAMinute,
};

export const TIMEOUT_EXCEEDED = new Error('Timeout Exceeded');

/**
 * Retries a operation with an exponential backoff.
 * The time between the requests are inceased by the "factor" until maxDuration is hit.
 * When the maxDuration is hit, the duration is reset to the initial duration.
 *
 * The retry function is expected to return a boolean that states if the operation should be retried.
 * It can also throw an error which immediately stops the operation and prevent further retries.
 *
 * @param retryFn the operation that should be retried.
 * @param config configure the backoff. If not set a default is used.
 */
export const retryWithBackoff = async (
    retryFn: () => Promise<boolean>,
    config: BackoffConfiguration = defaultBackoff): Promise<void> => {

    return new Promise((resolve, reject) => {

        let waitDuration: number = config.initialDuration;
        let retryTimeout: ReturnType<typeof setTimeout>;
        let completed: boolean = false;

        const maxTimeout = setTimeout(() => {
            clearTimeout(retryTimeout);
            completed = true;
            reject(TIMEOUT_EXCEEDED);
        }, config.timeout);

        const doRetry = async () => {
            if (completed) {
                return;
            }

            let done = false;
            try {
                done = await retryFn();
            } catch (err) {
                clearTimeout(maxTimeout);
                completed = true;
                reject(err);
                return;
            }

            if (done) {
                clearTimeout(maxTimeout);
                completed = true;
                resolve();
                return;
            }

            retryTimeout = setTimeout(doRetry, waitDuration);
            waitDuration = nextDuration(waitDuration, config);
        };

        doRetry();
    });
};

const nextDuration = (lastDuration: number, config: BackoffConfiguration) => {
    if (config.factor <= 0) {
        return config.initialDuration;
    }
    const nextDuration = lastDuration * config.factor;
    if (has(config.maxDuration) && nextDuration >= config.maxDuration) {
        return config.initialDuration;
    }
    return nextDuration;
};
