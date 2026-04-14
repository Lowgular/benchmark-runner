export type NodeMatch = {
  name: string;
  filePath: string;
};

export type EvalConfig = {
  expectedNodes: NodeMatch[];
};

export type AssessmentResult = {
  id: string;
  name: string;
  state: number;
  message: string;
  category: string;
  description: string;
  groupingLabels: string[];
  scoreReduction?: string;
  successPercentage: number;
};

export type EvalOutput = {
  totals: {
    expected: number;
    actual: number;
    truePositives: number;
    falsePositives: number;
    falseNegatives: number;
  };
  metrics: {
    precision: number;
    recall: number;
  };
  expectedNodes: NodeMatch[];
  actualNodes: NodeMatch[];
  truePositives: NodeMatch[];
  falsePositives: NodeMatch[];
  falseNegatives: NodeMatch[];
  assessments: AssessmentResult[];
};
