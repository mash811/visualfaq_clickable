"use client";

import { create } from "zustand";
import type { FlipNode, GenerateResponse, Hotspot } from "./types";

type AddNodeArgs = {
  topic: string;
  parentId: string | null;
  parentLabel?: string;
  response: GenerateResponse;
};

type FlipbookState = {
  nodes: Record<string, FlipNode>;
  currentId: string | null;
  // root → current id list, used for breadcrumbs.
  path: string[];
  styleSeed: string | null;
  loading: boolean;
  error: string | null;

  setLoading: (v: boolean) => void;
  setError: (msg: string | null) => void;
  setStyleSeed: (s: string | null) => void;
  addNode: (args: AddNodeArgs) => string;
  attachChildToHotspot: (
    parentId: string,
    hotspotIndex: number,
    childId: string
  ) => void;
  updateHotspots: (nodeId: string, hotspots: Hotspot[]) => void;
  navigateTo: (nodeId: string) => void;
  reset: () => void;

  current: () => FlipNode | null;
  pathNodes: () => FlipNode[];
};

export const useFlipbookStore = create<FlipbookState>((set, get) => ({
  nodes: {},
  currentId: null,
  path: [],
  styleSeed: null,
  loading: false,
  error: null,

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setStyleSeed: (styleSeed) => set({ styleSeed }),

  addNode: ({ topic, parentId, parentLabel, response }) => {
    const node: FlipNode = {
      id: response.nodeId,
      label: topic,
      parentLabel,
      imageUrl: response.imageUrl,
      hotspots: response.hotspots,
      parentId,
      createdAt: Date.now(),
    };
    set((state) => {
      const nodes = { ...state.nodes, [node.id]: node };
      const newPath = parentId
        ? [...buildPath(nodes, parentId), node.id]
        : [node.id];
      return { nodes, currentId: node.id, path: newPath };
    });
    return node.id;
  },

  attachChildToHotspot: (parentId, hotspotIndex, childId) =>
    set((state) => {
      const parent = state.nodes[parentId];
      if (!parent) return state;
      const hotspots = parent.hotspots.map((h, i) =>
        i === hotspotIndex ? { ...h, childNodeId: childId } : h
      );
      return {
        nodes: { ...state.nodes, [parentId]: { ...parent, hotspots } },
      };
    }),

  updateHotspots: (nodeId, hotspots) =>
    set((state) => {
      const node = state.nodes[nodeId];
      if (!node) return state;
      return {
        nodes: { ...state.nodes, [nodeId]: { ...node, hotspots } },
      };
    }),

  navigateTo: (nodeId) =>
    set((state) => {
      if (!state.nodes[nodeId]) return state;
      return { currentId: nodeId, path: buildPath(state.nodes, nodeId) };
    }),

  reset: () =>
    set({
      nodes: {},
      currentId: null,
      path: [],
      styleSeed: null,
      loading: false,
      error: null,
    }),

  current: () => {
    const { nodes, currentId } = get();
    return currentId ? nodes[currentId] ?? null : null;
  },

  pathNodes: () => {
    const { nodes, path } = get();
    return path.map((id) => nodes[id]).filter(Boolean) as FlipNode[];
  },
}));

function buildPath(
  nodes: Record<string, FlipNode>,
  leafId: string
): string[] {
  const ids: string[] = [];
  let cur: string | null = leafId;
  const guard = new Set<string>();
  while (cur && nodes[cur] && !guard.has(cur)) {
    ids.unshift(cur);
    guard.add(cur);
    cur = nodes[cur].parentId;
  }
  return ids;
}
