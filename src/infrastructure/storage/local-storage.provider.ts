import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { StorageObject, StorageProvider } from './storage-provider.js';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly root: string;
  private readonly publicBase: string;
  constructor(config: ConfigService) {
    this.root = resolve(
      config.get<string>('content.storagePath') ?? './storage',
    );
    this.publicBase = (config.get<string>('content.publicUrl') ?? '').replace(
      /\/$/,
      '',
    );
  }
  async put(input: {
    key: string;
    content: Buffer;
    contentType: string;
  }): Promise<StorageObject> {
    if (
      input.key.includes('..') ||
      input.key.includes('\\') ||
      input.key.startsWith('/')
    )
      throw new Error('Unsafe storage key');
    const target = resolve(join(this.root, input.key));
    if (!target.startsWith(`${this.root}/`))
      throw new Error('Unsafe storage path');
    await mkdir(resolve(target, '..'), { recursive: true });
    await writeFile(target, input.content, { flag: 'wx' });
    return {
      key: input.key,
      publicUrl: this.publicBase ? `${this.publicBase}/${input.key}` : null,
    };
  }
  async delete(key: string): Promise<void> {
    if (key.includes('..') || key.includes('\\') || key.startsWith('/'))
      throw new Error('Unsafe storage key');
    const target = resolve(join(this.root, key));
    if (!target.startsWith(`${this.root}/`))
      throw new Error('Unsafe storage path');
    await unlink(target).catch(() => undefined);
  }
}
