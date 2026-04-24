export type FaqEntry = {
  id: string;
  question: string;
  answer: string;
};

export type FaqSearchHit = {
  entry: FaqEntry;
  score: number; // 0 = perfect match, 1 = worst (Fuse.js convention)
};
