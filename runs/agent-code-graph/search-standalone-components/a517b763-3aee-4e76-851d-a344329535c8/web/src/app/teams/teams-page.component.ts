import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ButtonComponent } from '../shared/button';
import { MemberModule } from './member.module';
import { Team } from './team';
import { TeamsService } from './teams.service';

@Component({
  selector: 'app-teams-page',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MemberModule,
    ButtonComponent,
  ],
  templateUrl: './teams-page.component.html',
  styleUrl: './teams-page.component.scss',
})
export class TeamsPageComponent {
  private readonly teamsService = inject(TeamsService);
  private readonly fb = inject(FormBuilder);
  teams = toSignal(this.teamsService.getTeams(), { initialValue: [] });
  selectedTeam: Team | null = null;
  fetchedTeam: Team | null = null;
  errorMessage = '';
  isLoading = false;
  lookupId = '';

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    city: [''],
  });

  edit(team: Team): void {
    this.selectedTeam = team;
    this.form.setValue({
      name: team.name,
      city: team.city ?? '',
    });
  }

  cancelEdit(): void {
    this.selectedTeam = null;
    this.form.reset({ name: '', city: '' });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const body = {
      name: this.form.value.name?.trim() ?? '',
      city: (this.form.value.city?.trim() || null) as string | null,
    };

    if (this.selectedTeam) {
      this.teamsService.updateTeam(this.selectedTeam.id, body).subscribe({
        next: () => {
          this.cancelEdit();
          this.loadTeams();
        },
        error: () => {
          this.errorMessage = 'Could not update team.';
        },
      });
      return;
    }

    this.teamsService.createTeam(body).subscribe({
      next: () => {
        this.cancelEdit();
        this.loadTeams();
      },
      error: () => {
        this.errorMessage = 'Could not create team.';
      },
    });
  }

  delete(team: Team): void {
    this.teamsService.deleteTeam(team.id).subscribe({
      next: () => this.loadTeams(),
      error: () => {
        this.errorMessage = `Could not delete team ${team.id}.`;
      },
    });
  }

  fetchOne(): void {
    const id = Number(this.lookupId);
    if (!Number.isInteger(id) || id < 1) {
      this.errorMessage = 'Enter a valid team id.';
      return;
    }

    this.errorMessage = '';
    this.teamsService.getTeam(id).subscribe({
      next: (team) => {
        this.fetchedTeam = team;
      },
      error: () => {
        this.fetchedTeam = null;
        this.errorMessage = `Team ${id} was not found.`;
      },
    });
  }
}
