import { RATINGS } from "@lowgular/wcs-ratings";
import { RatingCategory } from "web-codegen-scorer";

// my-project/eval-config.js
export default {
  id: "1ad278ee-fdad-4a67-83c6-0519f977f886",
  displayName: "Angular 20 Greenfield",
  clientSideFramework: "angular",
  sourceDirectory: "./project",
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
