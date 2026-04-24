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
  childNodeId?: string;
};

export type FlipNode = {
  id: string;
  label: string;
  parentLabel?: string;
  imageUrl: string;
  hotspots: Hotspot[];
  parentId: string | null;
  createdAt: number;
};

export type GenerateRequest = {
  topic: string;
  parentContext?: string;
  parentNodeId?: string | null;
  styleSeed?: string;
};

export type GenerateResponse = {
  nodeId: string;
  imageId: string;
  imageUrl: string;
  hotspots: Hotspot[];
  hotspotsError?: string;
};
