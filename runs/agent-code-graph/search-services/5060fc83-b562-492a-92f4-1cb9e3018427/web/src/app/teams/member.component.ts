import { Component, Input } from '@angular/core';
import { Member } from './member';

@Component({
  selector: 'app-member',
  template: `
    <div>
      <h3 [alert]="member.name">{{ member.name }}</h3>
      <app-button [label]="'Read more about {{ member.name }}'"></app-button>
    </div>
  `,
  standalone: false,
})
export class MemberComponent {
  @Input() member!: Member;
}
