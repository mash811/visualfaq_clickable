export type Bbox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Hotspot = {
  label: string;
  englishLabel: string;
  bbox: Bbox;
  // The FAQ entry this hotspot resolved to, if any. If undefined, clicking the
  // hotspot is disabled in the UI because the app is FAQ-grounded.
  relatedFaqId?: string;
  // Populated client-side once a child node has been generated for this
  // hotspot so we can navigate back to it without regenerating.
  childNodeId?: string;
};

export type FlipNode = {
  id: string;
  faqId: string;
  question: string;
  answer: string;
  imageUrl: string;
  imageId: string;
  hotspots: Hotspot[];
  parentId: string | null;
  createdAt: number;
};

export type GenerateRequest = {
  // Direct-lookup mode (no RAG): just render the FAQ with this id.
  faqId?: string;
  // RAG mode: free-text query. Used when a hotspot is clicked — the server
  // runs retrieval (Fuse) + rerank (Claude) over the FAQ corpus to pick the
  // target entry.
  query?: string;
  // When drilling from a parent FAQ, pass its id so RAG can use it as context
  // and the image prompt knows to do a zoomed-in detail view.
  contextFaqId?: string | null;
  parentNodeId?: string | null;
  styleSeed?: string;
};

export type RelatedFaq = {
  id: string;
  question: string;
};

export type GenerateResponse = {
  nodeId: string;
  faqId: string;
  question: string;
  answer: string;
  imageId: string;
  imageUrl: string;
  hotspots: Hotspot[];
  related: RelatedFaq[];
  hotspotsError?: string;
};
