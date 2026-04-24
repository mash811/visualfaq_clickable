"use client";

import { create } from "zustand";
import type { FlipNode, GenerateResponse, Hotspot, RelatedFaq } from "./types";

type AddNodeArgs = {
  parentId: string | null;
  response: GenerateResponse;
};

type FlipbookState = {
  nodes: Record<string, FlipNode>;
  currentId: string | null;
  path: string[];
  styleSeed: string | null;
  loading: boolean;
  error: string | null;

  // Only the current node's related FAQs are kept here — they're derived from
  // the last generate response and shown in the side panel.
  currentRelated: RelatedFaq[];

  setLoading: (v: boolean) => void;
  setError: (msg: string | null) => void;
  setStyleSeed: (s: string | null) => void;
  setCurrentRelated: (r: RelatedFaq[]) => void;

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
  currentRelated: [],

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setStyleSeed: (styleSeed) => set({ styleSeed }),
  setCurrentRelated: (currentRelated) => set({ currentRelated }),

  addNode: ({ parentId, response }) => {
    const node: FlipNode = {
      id: response.nodeId,
      faqId: response.faqId,
      question: response.question,
      answer: response.answer,
      imageUrl: response.imageUrl,
      imageId: response.imageId,
      hotspots: response.hotspots,
      parentId,
      createdAt: Date.now(),
    };
    set((state) => {
      const nodes = { ...state.nodes, [node.id]: node };
      const newPath = parentId
        ? [...buildPath(nodes, parentId), node.id]
        : [node.id];
      return {
        nodes,
        currentId: node.id,
        path: newPath,
        currentRelated: response.related,
      };
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
      // When navigating back to an existing node we don't have the stored
      // related list; recompute from hotspots that resolved to FAQs.
      const node = state.nodes[nodeId];
      const seen = new Set<string>();
      const currentRelated: RelatedFaq[] = [];
      for (const h of node.hotspots) {
        if (!h.relatedFaqId || seen.has(h.relatedFaqId)) continue;
        seen.add(h.relatedFaqId);
        // label may drift from the official FAQ question; we only have the id
        // here, so the side panel will fetch the full question via props.
        currentRelated.push({ id: h.relatedFaqId, question: h.label });
      }
      return {
        currentId: nodeId,
        path: buildPath(state.nodes, nodeId),
        currentRelated,
      };
    }),

  reset: () =>
    set({
      nodes: {},
      currentId: null,
      path: [],
      styleSeed: null,
      loading: false,
      error: null,
      currentRelated: [],
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
