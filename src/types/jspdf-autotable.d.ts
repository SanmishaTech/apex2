// Type declarations for jspdf-autotable
declare module 'jspdf-autotable' {
  import { jsPDF } from 'jspdf';

  export interface CellDef {
    content?: string;
    colSpan?: number;
    rowSpan?: number;
    styles?: Partial<Styles>;
  }

  export interface RowInput {
    [key: string]: string | number | CellDef;
  }

  export interface Styles {
    font?: string;
    fontStyle?: string;
    overflow?: 'linebreak' | 'ellipsize' | 'visible' | 'hidden';
    fillColor?: number | [number, number, number] | false;
    textColor?: number | [number, number, number];
    cellPadding?: number;
    fontSize?: number;
    minCellHeight?: number;
    minCellWidth?: number;
    halign?: 'left' | 'center' | 'right';
    valign?: 'top' | 'middle' | 'bottom';
    cellWidth?: number | 'auto' | 'wrap';
  }

  export interface CellHookData {
    cell: {
      text: string[];
      styles: Styles;
    };
    row: {
      index: number;
      section: 'head' | 'body' | 'foot';
    };
    column: {
      index: number;
      dataKey?: string | number;
    };
    section: 'head' | 'body' | 'foot';
  }

  export interface UserOptions {
    head?: (string | CellDef)[][];
    body?: (string | number | CellDef)[][];
    foot?: (string | CellDef)[][];
    startY?: number;
    margin?: number;
    theme?: 'striped' | 'grid' | 'plain';
    styles?: Partial<Styles>;
    headStyles?: Partial<Styles>;
    bodyStyles?: Partial<Styles>;
    footStyles?: Partial<Styles>;
    columnStyles?: { [key: number]: Partial<Styles> };
    didParseCell?: (data: CellHookData) => void;
    willDrawCell?: (data: CellHookData) => void;
    didDrawCell?: (data: CellHookData) => void;
    didDrawPage?: (data: any) => void;
  }

  export default function autoTable(doc: jsPDF, options: UserOptions): jsPDF;
}
