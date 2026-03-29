declare module "x-data-spreadsheet/dist/xspreadsheet" {
  const Spreadsheet: {
    new (target: Element, options?: Record<string, unknown>): {
      loadData: (data: unknown) => unknown;
      getData: () => unknown[];
      change: (cb: () => void) => unknown;
    };
    locale: (key: string, locale: Record<string, unknown>) => void;
  };
  export default Spreadsheet;
}

declare module "x-data-spreadsheet/dist/locale/zh-cn" {
  const locale: Record<string, unknown>;
  export default locale;
}
