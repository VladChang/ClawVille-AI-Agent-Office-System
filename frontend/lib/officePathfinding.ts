import { pointInAnyPolygon, type Point } from '@/lib/officeGeometry';
import type { OfficeMap } from '@/lib/officeMap';

type GridCell = { col: number; row: number };

export type OfficeNavigationGrid = {
  cellSize: number;
  cols: number;
  rows: number;
  walkable: Uint8Array;
};

const cardinalDirections: GridCell[] = [
  { col: 1, row: 0 },
  { col: -1, row: 0 },
  { col: 0, row: 1 },
  { col: 0, row: -1 }
];

function toIndex(grid: OfficeNavigationGrid, cell: GridCell): number {
  return cell.row * grid.cols + cell.col;
}

function withinBounds(grid: OfficeNavigationGrid, cell: GridCell): boolean {
  return cell.col >= 0 && cell.col < grid.cols && cell.row >= 0 && cell.row < grid.rows;
}

export function isWalkableCell(grid: OfficeNavigationGrid, cell: GridCell): boolean {
  return withinBounds(grid, cell) && grid.walkable[toIndex(grid, cell)] === 1;
}

export function buildOfficeNavigationGrid(officeMap: OfficeMap, cellSize = 20): OfficeNavigationGrid {
  const cols = Math.ceil(officeMap.width / cellSize);
  const rows = Math.ceil(officeMap.height / cellSize);
  const walkable = new Uint8Array(cols * rows);

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const point = {
        x: col * cellSize + cellSize / 2,
        y: row * cellSize + cellSize / 2
      };

      const insideWalkable = pointInAnyPolygon(point, officeMap.walkableAreas);
      const insideObstacle = pointInAnyPolygon(point, officeMap.obstacles);

      if (insideWalkable && !insideObstacle) {
        walkable[row * cols + col] = 1;
      }
    }
  }

  return { cellSize, cols, rows, walkable };
}

export function pointToCell(grid: OfficeNavigationGrid, point: Point): GridCell {
  return {
    col: Math.max(0, Math.min(grid.cols - 1, Math.floor(point.x / grid.cellSize))),
    row: Math.max(0, Math.min(grid.rows - 1, Math.floor(point.y / grid.cellSize)))
  };
}

export function cellToPoint(grid: OfficeNavigationGrid, cell: GridCell): Point {
  return {
    x: cell.col * grid.cellSize + grid.cellSize / 2,
    y: cell.row * grid.cellSize + grid.cellSize / 2
  };
}

export function findNearestWalkableCell(grid: OfficeNavigationGrid, start: GridCell): GridCell | null {
  if (isWalkableCell(grid, start)) return start;

  const queue: GridCell[] = [start];
  const seen = new Set<number>([toIndex(grid, start)]);

  while (queue.length > 0) {
    const current = queue.shift() as GridCell;

    for (const direction of cardinalDirections) {
      const next = {
        col: current.col + direction.col,
        row: current.row + direction.row
      };

      if (!withinBounds(grid, next)) continue;

      const index = toIndex(grid, next);
      if (seen.has(index)) continue;
      seen.add(index);

      if (isWalkableCell(grid, next)) return next;
      queue.push(next);
    }
  }

  return null;
}

function heuristic(a: GridCell, b: GridCell): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

function compressPath(path: Point[]): Point[] {
  if (path.length <= 2) return path;

  const compressed: Point[] = [path[0]];

  for (let index = 1; index < path.length - 1; index += 1) {
    const prev = compressed[compressed.length - 1];
    const current = path[index];
    const next = path[index + 1];

    const sameVertical = prev.x === current.x && current.x === next.x;
    const sameHorizontal = prev.y === current.y && current.y === next.y;

    if (!sameVertical && !sameHorizontal) {
      compressed.push(current);
    }
  }

  compressed.push(path[path.length - 1]);
  return compressed;
}

export function findOfficePath(grid: OfficeNavigationGrid, startPoint: Point, endPoint: Point): Point[] {
  const startCell = findNearestWalkableCell(grid, pointToCell(grid, startPoint));
  const goalCell = findNearestWalkableCell(grid, pointToCell(grid, endPoint));

  if (!startCell || !goalCell) return [];

  if (startCell.col === goalCell.col && startCell.row === goalCell.row) {
    return [cellToPoint(grid, goalCell)];
  }

  const open: GridCell[] = [startCell];
  const cameFrom = new Map<string, GridCell>();
  const gScore = new Map<string, number>([[`${startCell.col}:${startCell.row}`, 0]]);
  const fScore = new Map<string, number>([[`${startCell.col}:${startCell.row}`, heuristic(startCell, goalCell)]]);

  while (open.length > 0) {
    open.sort((left, right) => (fScore.get(`${left.col}:${left.row}`) ?? Number.POSITIVE_INFINITY) - (fScore.get(`${right.col}:${right.row}`) ?? Number.POSITIVE_INFINITY));
    const current = open.shift() as GridCell;

    if (current.col === goalCell.col && current.row === goalCell.row) {
      const cells: GridCell[] = [current];
      let cursorKey = `${current.col}:${current.row}`;

      while (cameFrom.has(cursorKey)) {
        const parent = cameFrom.get(cursorKey) as GridCell;
        cells.push(parent);
        cursorKey = `${parent.col}:${parent.row}`;
      }

      cells.reverse();
      return compressPath(cells.map((cell) => cellToPoint(grid, cell)));
    }

    for (const direction of cardinalDirections) {
      const neighbor = {
        col: current.col + direction.col,
        row: current.row + direction.row
      };

      if (!isWalkableCell(grid, neighbor)) continue;

      const currentKey = `${current.col}:${current.row}`;
      const neighborKey = `${neighbor.col}:${neighbor.row}`;
      const tentative = (gScore.get(currentKey) ?? Number.POSITIVE_INFINITY) + 1;

      if (tentative >= (gScore.get(neighborKey) ?? Number.POSITIVE_INFINITY)) continue;

      cameFrom.set(neighborKey, current);
      gScore.set(neighborKey, tentative);
      fScore.set(neighborKey, tentative + heuristic(neighbor, goalCell));

      if (!open.some((cell) => cell.col === neighbor.col && cell.row === neighbor.row)) {
        open.push(neighbor);
      }
    }
  }

  return [];
}
