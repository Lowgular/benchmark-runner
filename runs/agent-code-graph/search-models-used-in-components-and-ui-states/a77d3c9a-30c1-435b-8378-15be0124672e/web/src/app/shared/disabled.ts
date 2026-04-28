import { Directive, input } from '@angular/core';

@Directive({
  selector: '[alert]',
  host: {
    '(click)': 'showAlert()',
  },
})
export class AlertDirective {
  alert = input.required<string>();

  showAlert(): void {
    window.alert(this.alert());
  }
}

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
