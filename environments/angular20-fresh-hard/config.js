import { RATINGS } from "@lowgular/wcs-ratings";
import { RatingCategory } from "web-codegen-scorer";

// my-project/eval-config.js
export default {
  id: "f3b7cde2-8776-4998-b970-72c1670db50f",
  displayName: "Angular 20 Greenfield Hard",
  clientSideFramework: "angular",
  sourceDirectory: "../../init-states/angular-20-fresh-hard",
  ratings: [...Object.values(RATINGS)],
  generationSystemPrompt: "./system-instructions.md",
  executablePrompts: ["../../prompts/**/*.md"],
  packageManager: "npm",
  categoryOverrides: {
    [RatingCategory.HIGH_IMPACT]: { maxPoints: 50, name: "High" },
    [RatingCategory.MEDIUM_IMPACT]: { maxPoints: 30, name: "Medium" },
    [RatingCategory.LOW_IMPACT]: { maxPoints: 20, name: "Low" },
  },
};
