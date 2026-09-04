import { Injectable } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import type { Readable } from 'node:stream';
import path from 'node:path';
import type { SystemArtifactStorage } from '../../domain/repositories/system-artifact.storage.js';

const ROOT = '/tmp/estate-pro-artifacts';

@Injectable()
export class LocalSystemArtifactStorage implements SystemArtifactStorage {
  async put(id: string, data: Buffer, extension: string) {
    await fs.mkdir(ROOT, { recursive: true });
    const safeExtension = extension.replace(/[^a-z0-9]/gi, '');
    const file = path.join(ROOT, `${id}.${safeExtension}`);
    await fs.writeFile(file, data, { mode: 0o600 });
    return { path: file };
  }

  read(file: string) {
    return fs.readFile(file);
  }

  remove(file: string) {
    return fs.rm(file, { force: true });
  }

  stream(file: string): Readable {
    return createReadStream(file);
  }
}
