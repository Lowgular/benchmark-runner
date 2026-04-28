import { Component, inject, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AnalyticsState } from './analytics/analytics.state';
import { MemberModule } from './teams/member.module';
import { Team as TeamType } from './teams/team';

@Component({
  standalone: true,
  imports: [RouterModule, MemberModule],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'teams-web';

  private readonly analyticsState = inject(AnalyticsState);

  stubTeam() {
    return {
      id: 1,
      name: 'Team 1',
      city: 'City 1',
      members: [],
    } as TeamType;
  }

  ngOnInit() {
    this.analyticsState.trackUrl('/');
  }
}
