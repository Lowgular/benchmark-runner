import { RATINGS } from "@lowgular/wcs-ratings";
import { RatingCategory } from "web-codegen-scorer";

// my-project/eval-config.js
export default {
  id: "angular-20-greenfield",
  displayName: "Angular 20 Greenfield",
  clientSideFramework: "angular",
  sourceDirectory: "../../init-states/angular-20-fresh",
  ratings: [...Object.values(RATINGS)],
  generationSystemPrompt: "./system-instructions.md",
  executablePrompts: ["../../tasks/entry/**/*.md"],
  packageManager: "npm",
  categoryOverrides: {
    [RatingCategory.HIGH_IMPACT]: { maxPoints: 50, name: "High" },
    [RatingCategory.MEDIUM_IMPACT]: { maxPoints: 30, name: "Medium" },
    [RatingCategory.LOW_IMPACT]: { maxPoints: 20, name: "Low" },
  },
};
