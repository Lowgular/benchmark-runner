import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "app-newsletter-form",
  templateUrl: "./newsletter-form.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsletterForm {}
