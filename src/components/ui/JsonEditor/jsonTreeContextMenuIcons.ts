import type { Component } from 'vue'
import {
  ArrowDownWideNarrow,
  ArrowUpDown,
  ArrowUpWideNarrow,
  Box,
  Braces,
  Brackets,
  ClipboardPaste,
  Copy,
  CopyPlus,
  PenLine,
  Pencil,
  RefreshCw,
  Scissors,
  CircleDot,
  Ellipsis,
  Trash2,
} from 'lucide-vue-next'

const byLabel: Record<string, Component> = {
  'Edit key': Pencil,
  'Edit value': PenLine,
  'Cut formatted': Scissors,
  'Cut compacted': Scissors,
  'Copy formatted': Copy,
  'Copy compacted': Copy,
  Paste: ClipboardPaste,
  Duplicate: CopyPlus,
  Edit: Pencil,
  Cut: Scissors,
  Copy: Copy,
  Sort: ArrowUpDown,
  ASC: ArrowUpWideNarrow,
  DESC: ArrowDownWideNarrow,
  'Convert to': RefreshCw,
  Structure: Box,
  Object: Braces,
  Array: Brackets,
  Value: CircleDot,
  Remove: Trash2,
}

export function jsonTreeContextMenuIcon(
  label: string | undefined,
): Component {
  if (!label) return Ellipsis
  return byLabel[label] ?? Ellipsis
}
