import {exec, ExecException} from 'child_process';

export interface Options {
    printStdout?: boolean,
    printStderr?: boolean,
    stdin?: string,
}

export interface ExecResult {
    stdout: string,
    stderr: string,
}

export class ExecPromise extends Promise<ExecResult> {
}

export const execAsync = (command: string, options: Options = {
    printStderr: true,
    printStdout: true,
}): ExecPromise => {
    const promise = new ExecPromise((resolve, reject) => {
        const e = exec(command, (error: ExecException | null, stdout: string, stderr: string) => {
            if (error) {
                reject(new Error(`process exited with code ${error.code} ${error.message}`));
            }
            if (options.printStderr ?? true) {
                console.log(stdout);
            }
            if (options.printStderr ?? true) {
                console.log(stderr);
            }
            resolve({
                stdout,
                stderr,
            });
        });
        if (options.stdin && e.stdin) {
            e.stdin.write(options.stdin);
            e.stdin.end();
        }

    });
    return promise;
};
