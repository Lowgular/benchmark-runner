import { Component, computed, input, signal } from '@angular/core';
import { Member } from './member';
import { ViewingPreferences } from './viewing-preferences';

@Component({
  selector: 'app-member',
  template: `
    @if (stateRead()?.showOrg === true) {
    <div>
      <h3 alert="{{ org() }}">{{ member().name }}</h3>
      <app-button [label]="'Read more about' + member().name"></app-button>
    </div>
    }
  `,
  standalone: false,
})
export class MemberComponent {
  member = input.required<Member>();
  preferences: ViewingPreferences = {
    showDetails: true,
    emphasis: 'organization',
  };

  private readonly state = signal<{ org: string; showOrg: true }>({
    org: 'Angular',
    showOrg: true,
  });

  stateRead = this.state.asReadonly();

  org = computed(() => this.state().org);
}
