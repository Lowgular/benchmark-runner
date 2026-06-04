import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
    selector: 'app-pricing',
    templateUrl: './pricing.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class Pricing {}