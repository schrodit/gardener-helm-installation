import axios from 'axios';
import { createWriteStream } from 'fs';
import * as stream from 'stream';
import { promisify } from 'util';

const finished = promisify(stream.finished);

export const downloadFile = async (url: string, out: string): Promise<void> => {
    const writer = createWriteStream(out);
    return axios({
      method: 'get',
      url: url,
      responseType: 'stream',
    }).then(async response => {
      response.data.pipe(writer);
      return finished(writer); //this is a Promise
    });
};
