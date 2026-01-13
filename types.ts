
export enum DataType {
  SELECTED = '1',
  TOTAL_TRADE = '2',
  FOREIGNER = '3',
  INSTITUTIONAL = '4'
}

export interface StockDataRow {
  [key: string]: any;
}

export interface UploadedFile {
  id: string;
  type: DataType;
  name: string;
  rowCount: number;
  uploadTime: string;
  date?: string; // YYMMDD format
  data: StockDataRow[];
}

export interface GlobalState {
  files: UploadedFile[];
}
