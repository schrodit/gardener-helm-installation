import {createWriteStream} from 'fs';
import * as stream from 'stream';
import {promisify} from 'util';
import axios from 'axios';
import {rm} from "fs/promises";

const finished = promisify(stream.finished);

export const downloadFile = async (url: string, out: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const writer = createWriteStream(out);
        axios({
            method: 'get',
            url,
            responseType: 'stream',
        }).then(async response => {
            response.data.pipe(writer);
            await finished(writer); // this is a Promise
            resolve();
        }).catch(async err => {
            await rm(out, {force: true});
            reject(new Error(`Failed request to ${url}: ${err.toString()}`));
        });
    });
};
