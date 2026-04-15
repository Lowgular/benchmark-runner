import { RATINGS } from "@lowgular/wcs-ratings";
import { RatingCategory } from "web-codegen-scorer";

// my-project/eval-config.js
export default {
  id: "angular-20-legacy",
  displayName: "Angular 20 Legacy",
  clientSideFramework: "angular",
  sourceDirectory: "../../init-states/angular-20-legacy",
  ratings: [RATINGS.subscriptionManagementRating],
  generationSystemPrompt: "./system-instructions.md",
  repairSystemPrompt: "./system-instructions.md",
  executablePrompts: ["../../tasks/rules/**/*.md"],
  packageManager: "npm",
  categoryOverrides: {
    [RatingCategory.HIGH_IMPACT]: { maxPoints: 50, name: "High" },
    [RatingCategory.MEDIUM_IMPACT]: { maxPoints: 30, name: "Medium" },
    [RatingCategory.LOW_IMPACT]: { maxPoints: 20, name: "Low" },
  },
};
