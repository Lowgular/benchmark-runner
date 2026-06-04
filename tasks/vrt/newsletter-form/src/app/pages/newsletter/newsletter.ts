import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "app-newsletter",
  templateUrl: "./newsletter.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Newsletter {}
