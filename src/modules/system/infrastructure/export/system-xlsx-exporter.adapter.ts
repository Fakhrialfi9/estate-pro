import { Injectable } from '@nestjs/common';
import { buildXlsx } from './xlsx-export.js';
import type { SystemXlsxExporter } from '../../domain/repositories/system-xlsx-exporter.port.js';

@Injectable()
export class SystemXlsxExporterAdapter implements SystemXlsxExporter {
  build(headers: readonly string[], rows: readonly (readonly unknown[])[]): Buffer {
    return buildXlsx(headers, rows);
  }
}
