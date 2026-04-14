import { Directive, input } from '@angular/core';
@Directive({
  selector: 'button',
  host: {
    '[disabled]': 'disabled()',
    '[attr.style.border]': 'disabled() ? "1px solid red" : "1px solid green"',
  },
})
export class DisabledDirective {
  disabled = input.required<string>();
}
