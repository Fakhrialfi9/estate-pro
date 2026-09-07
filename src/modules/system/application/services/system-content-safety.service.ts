import { BadRequestException, Injectable } from '@nestjs/common';

const MAX_TEXT_BYTES = 5 * 1024 * 1024;
const FORMULA_PREFIXES = ['=', '+', '-', '@'];

@Injectable()
export class SystemContentSafetyService {
  inspectImport(buffer: Buffer, format: 'csv' | 'json'): void {
    if (buffer.length === 0) throw new BadRequestException('Import content is empty');
    if (buffer.length > MAX_TEXT_BYTES)
      throw new BadRequestException('Import content exceeds safety limit');

    const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
    if (sample.includes(0))
      throw new BadRequestException('Binary content is not allowed for text import');

    const text = buffer.toString('utf8');
    if (text.includes('\uFFFD'))
      throw new BadRequestException('Import contains invalid UTF-8 content');

    if (format === 'csv') this.inspectCsv(text);
    else this.inspectJson(text);
  }

  sanitizeExportCell(value: string): string {
    const trimmed = value.trimStart();
    return FORMULA_PREFIXES.includes(trimmed.charAt(0)) ? `'${value}` : value;
  }

  private inspectCsv(content: string): void {
    for (const line of content.split(/\r?\n/, 257)) {
      if (line.length > 50_000)
        throw new BadRequestException('CSV row exceeds the safety limit');
    }
  }

  private inspectJson(content: string): void {
    if (content.length > MAX_TEXT_BYTES)
      throw new BadRequestException('JSON content exceeds the safety limit');
  }
}
