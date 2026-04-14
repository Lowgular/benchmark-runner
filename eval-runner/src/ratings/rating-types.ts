import { NodeMatch } from "../types.js";

export enum RatingKind {
  PER_BUILD = "PER_BUILD",
}

export enum RatingCategory {
  HIGH_IMPACT = "high-impact",
  MEDIUM_IMPACT = "medium-impact",
  LOW_IMPACT = "low-impact",
}

export enum RatingState {
  EXECUTED = 0,
}

export type PerBuildRatingInput = {
  expected: NodeMatch[];
  actual: NodeMatch[];
};

export type PerBuildRatingResult = {
  state: RatingState;
  coefficient: number;
  message: string;
};

export type PerBuildRating = {
  name: string;
  description: string;
  id: string;
  kind: RatingKind.PER_BUILD;
  category: RatingCategory;
  groupingLabels: string[];
  scoreReduction?: string;
  rate: (input: PerBuildRatingInput) => PerBuildRatingResult;
};
