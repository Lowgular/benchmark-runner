import { BaseCellRendererComponent } from "@shared/components";
import { TestService } from "./test.service";

export class StarredCellRendererComponent extends BaseCellRendererComponent<boolean> {
  constructor(private readonly test: TestService) {
    super();
  }
}
