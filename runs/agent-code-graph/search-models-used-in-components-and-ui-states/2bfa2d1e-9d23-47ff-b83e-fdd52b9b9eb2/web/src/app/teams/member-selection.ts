import { signal, WritableSignal } from '@angular/core';
import { Member } from './member';
import { ViewingPreferences } from './viewing-preferences';

export class MemberSelection {
  private readonly selectedMember: WritableSignal<Member | null> =
    signal<Member | null>(null);
  private readonly preferences: WritableSignal<ViewingPreferences> = signal({
    showDetails: true,
    emphasis: 'organization',
  });

  getSelectedMember(): Member | null {
    return this.selectedMember();
  }

  setSelectedMember(member: Member | null): void {
    this.selectedMember.set(member);
  }

  getPreferences(): ViewingPreferences {
    return this.preferences();
  }

  setPreferences(preferences: ViewingPreferences): void {
    this.preferences.set(preferences);
  }
}
