type Point = {
  line: number;
  column: number;
  offset: number;
};

type Location = {
  toPoint: (offset: number) => Point | undefined;
  toOffset: (point: { line: number; column: number }) => number | undefined;
};

const vfileLocation = (file: unknown): Location => {
  const value = String(file);
  const indices: number[] = [];

  const next = (from: number) => {
    const cr = value.indexOf('\r', from);
    const lf = value.indexOf('\n', from);
    if (lf === -1) return cr;
    if (cr === -1 || cr + 1 === lf) return lf;
    return cr < lf ? cr : lf;
  };

  const toPoint = (offset: number): Point | undefined => {
    if (typeof offset !== 'number' || offset < 0 || offset > value.length) {
      return undefined;
    }
    let index = 0;
    while (true) {
      let end = indices[index];
      if (end === undefined) {
        const eol = next(indices[index - 1] ?? 0);
        end = eol === -1 ? value.length + 1 : eol + 1;
        indices[index] = end;
      }
      if (end > offset) {
        const previous = index > 0 ? indices[index - 1] : 0;
        return { line: index + 1, column: offset - previous + 1, offset };
      }
      index += 1;
    }
  };

  const toOffset = (point: { line: number; column: number }): number | undefined => {
    if (
      !point ||
      typeof point.line !== 'number' ||
      typeof point.column !== 'number' ||
      Number.isNaN(point.line) ||
      Number.isNaN(point.column)
    ) {
      return undefined;
    }

    while (indices.length < point.line) {
      const from = indices[indices.length - 1] ?? 0;
      const eol = next(from);
      const end = eol === -1 ? value.length + 1 : eol + 1;
      if (from === end) break;
      indices.push(end);
    }

    const offset = (point.line > 1 ? indices[point.line - 2] : 0) + point.column - 1;
    if (offset < indices[point.line - 1]) return offset;
    return undefined;
  };

  return { toPoint, toOffset };
};

export { vfileLocation as location };
