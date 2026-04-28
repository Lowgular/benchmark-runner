import { Component, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-button',
  template: `
    <button [disabled]="disabled()" (click)="clicked.emit()">
      {{ label }}
    </button>
  `,
})
export class ButtonComponent {
  label = input.required<string>();

  disabled = signal<boolean>(true);

  clicked = output<void>();
}
