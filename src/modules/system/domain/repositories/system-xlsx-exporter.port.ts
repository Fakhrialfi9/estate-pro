export type SystemXlsxExporter = Readonly<{
  build(
    headers: readonly string[],
    rows: readonly (readonly unknown[])[],
  ): Buffer;
}>;

export const SYSTEM_XLSX_EXPORTER = Symbol('SYSTEM_XLSX_EXPORTER');
