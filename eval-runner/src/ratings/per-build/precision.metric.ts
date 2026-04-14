import {
  PerBuildRating,
  RatingCategory,
  RatingKind,
  RatingState,
} from "../rating-types.js";
import { countIntersection, toUniqueNodeList } from "../node-match.utils.js";

/** Rating which verifies how many returned nodes are correct. */
export const precisionMetric: PerBuildRating = {
  name: "Precision",
  description:
    "Measures how many returned nodes in the final answer are correct.",
  id: "precision",
  kind: RatingKind.PER_BUILD,
  category: RatingCategory.HIGH_IMPACT,
  groupingLabels: ["Retrieval"],
  scoreReduction: "50%",
  rate: ({ expected, actual }) => {
    const actualUnique = toUniqueNodeList(actual);
    const matches = countIntersection(expected, actualUnique);
    const denominator = actualUnique.length;
    const coefficient = denominator === 0 ? 0 : matches / denominator;
    const percent = Math.round(coefficient * 100);

    const status =
      coefficient >= 1
        ? "Pass"
        : coefficient <= 0
          ? "Fail"
          : `Partial Pass (${percent}%)`;

    return {
      state: RatingState.EXECUTED,
      coefficient,
      message: `${status}\nPrecision: ${matches}/${denominator} (${percent}%)`,
    };
  },
};
