import { NodeMatch } from "../types.js";

const nodeKey = (node: NodeMatch): string => `${node.name}::${node.filePath}`;

export const toUniqueNodeList = (nodes: NodeMatch[]): NodeMatch[] => {
  const seen = new Set<string>();
  const result: NodeMatch[] = [];
  for (const node of nodes) {
    const key = nodeKey(node);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(node);
  }
  return result;
};

export const countIntersection = (
  left: NodeMatch[],
  right: NodeMatch[],
): number => {
  const leftKeys = new Set(toUniqueNodeList(left).map((node) => nodeKey(node)));
  const rightKeys = new Set(
    toUniqueNodeList(right).map((node) => nodeKey(node)),
  );
  let matches = 0;
  for (const key of rightKeys) {
    if (leftKeys.has(key)) matches += 1;
  }
  return matches;
};
