export interface WordToken {
  text: string;
  x0: number;
  x1: number;
  top: number;
  bottom: number;
}

export interface PageData {
  page: number;
  width: number;
  height: number;
  words: WordToken[];
  tables: string[][][];
}

export interface ExtractorOutput {
  pages: PageData[];
}

export interface RowBucket {
  topCenter: number; // median top value for this row
  tokens: WordToken[];
}

export interface GridCell {
  colIndex: number;
  colName: string;
  rawText: string;
  isSpill: boolean;
}

export interface GridRow {
  rowIndex: number;
  cells: GridCell[];
  isSpillRow: boolean;
}