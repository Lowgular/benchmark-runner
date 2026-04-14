import {
  PerBuildRating,
  RatingCategory,
  RatingKind,
  RatingState,
} from "../rating-types.js";
import { countIntersection, toUniqueNodeList } from "../node-match.utils.js";

/** Rating which verifies how many expected nodes are returned. */
export const recallMetric: PerBuildRating = {
  name: "Recall",
  description: "Measures how many expected nodes were found in the final answer.",
  id: "recall",
  kind: RatingKind.PER_BUILD,
  category: RatingCategory.HIGH_IMPACT,
  groupingLabels: ["Retrieval"],
  scoreReduction: "50%",
  rate: ({ expected, actual }) => {
    const expectedUnique = toUniqueNodeList(expected);
    const matches = countIntersection(expectedUnique, actual);
    const denominator = expectedUnique.length;
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
      message: `${status}\nRecall: ${matches}/${denominator} (${percent}%)`,
    };
  },
};
