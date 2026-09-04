import { createReadStream, createWriteStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { Injectable } from '@nestjs/common';
import type { SystemArtifactStorage } from '../../domain/repositories/system-artifact.storage.js';

const ROOT = '/tmp/estate-pro-artifacts';

@Injectable()
export class LocalSystemArtifactStorage implements SystemArtifactStorage {
  async put(id: string, data: Buffer, extension: string) {
    return this.putStream(id, Readable.from([data]), extension);
  }

  async putStream(id: string, stream: Readable, extension: string) {
    await fs.mkdir(ROOT, { recursive: true, mode: 0o700 });
    const safeExtension = extension.replace(/[^a-z0-9]/gi, '');
    const file = path.join(ROOT, `${id}.${safeExtension}`);
    try {
      await pipeline(stream, createWriteStream(file, { mode: 0o600 }));
    } catch (error) {
      await fs.rm(file, { force: true }).catch(() => undefined);
      throw error;
    }
    return { path: file };
  }

  async health(): Promise<void> {
    await fs.mkdir(ROOT, { recursive: true, mode: 0o700 });
    await fs.access(ROOT, 0o2);
  }

  read(file: string) {
    return fs.readFile(file);
  }

  async size(file: string) {
    const stat = await fs.stat(file);
    return stat.size;
  }

  remove(file: string) {
    return fs.rm(file, { force: true });
  }

  stream(file: string) {
    return createReadStream(file);
  }
}
