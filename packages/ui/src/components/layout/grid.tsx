import { Children, isValidElement, type ReactNode } from "react";
import { View, type ViewProps } from "react-native";

import { useBreakpoint } from "../../hooks/use-breakpoint";
import { useIsClient } from "../../hooks/use-is-client";
import { cn } from "../../lib/cn";
import { gapClass, type Gap } from "./layout.styles";

/** Columns per window: on a phone, from 768 and from 1024. */
export interface GridColumns {
  readonly base?: number | undefined;
  readonly md?: number | undefined;
  readonly lg?: number | undefined;
}

export interface GridProps extends Omit<ViewProps, "children"> {
  readonly children?: ReactNode;
  /** Default 1 on a phone, 2 from 768, 3 from 1024 (D3's destination tiles). */
  readonly columns?: GridColumns | undefined;
  /** Between the cells, across and down (default 4.5: the mocks' 18). */
  readonly gap?: Gap | undefined;
  readonly className?: string;
}

function useColumnCount(columns: GridColumns | undefined): number {
  const isClient = useIsClient();
  const { atLeast } = useBreakpoint();
  const base = columns?.base ?? 1;
  const md = columns?.md ?? 2;
  if (!isClient || !atLeast("md")) return Math.max(1, base);
  return Math.max(1, atLeast("lg") ? (columns?.lg ?? 3) : md);
}

/** The children in rows of `count`; the last row is padded so every cell keeps the same width. */
function rowsOf(cells: readonly ReactNode[], count: number): (ReactNode | null)[][] {
  const rows: (ReactNode | null)[][] = [];
  for (let start = 0; start < cells.length; start += count) {
    const row: (ReactNode | null)[] = cells.slice(start, start + count);
    while (row.length < count) row.push(null);
    rows.push(row);
  }
  return rows;
}

/**
 * Cards in equal columns that follow the window: one on a phone, two from 768, three from 1024 by
 * default (tiles, media thumbnails, a shortlist). Empty children (null, false) take no cell.
 *
 *   <Grid columns={{ md: 2, lg: 4 }}>
 *     {photos.map((photo) => <MediaTile key={photo.id} photo={photo} />)}
 *   </Grid>
 */
export function Grid({ children, columns, gap = 4.5, className, ...rest }: GridProps) {
  const count = useColumnCount(columns);
  const cells = Children.toArray(children);
  return (
    <View className={cn("flex-col", gapClass[gap], className)} {...rest}>
      {rowsOf(cells, count).map((row, rowIndex) => (
        <View key={rowIndex} className={cn("flex-row items-stretch", gapClass[gap])}>
          {row.map((cell, cellIndex) => (
            <View
              key={isValidElement(cell) && cell.key !== null ? cell.key : `empty-${cellIndex}`}
              className="min-w-0 flex-1 basis-0"
            >
              {cell}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
