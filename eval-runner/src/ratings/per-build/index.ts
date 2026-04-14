import { precisionMetric } from "./precision.metric.js";
import { recallMetric } from "./recall.metric.js";
import { PerBuildRating } from "../rating-types.js";

export const perBuildRatings: PerBuildRating[] = [recallMetric, precisionMetric];
