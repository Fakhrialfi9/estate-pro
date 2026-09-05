import { Injectable } from '@nestjs/common';
import type { SystemXlsxExporter } from '../../domain/repositories/system-xlsx-exporter.port.js';
import { buildXlsx } from './xlsx-export.js';

@Injectable()
export class SystemXlsxExporterAdapter implements SystemXlsxExporter {
  build(
    headers: readonly string[],
    rows: readonly (readonly unknown[])[],
  ): Buffer {
    return buildXlsx(headers, rows);
  }
}
