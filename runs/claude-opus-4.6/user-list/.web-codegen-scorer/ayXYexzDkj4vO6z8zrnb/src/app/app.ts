import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { UserService } from './services/user.service';
import { EuropeanDatePipe } from './pipes/european-date.pipe';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  imports: [EuropeanDatePipe],
})
export class App {
  private userService = inject(UserService);
  users = toSignal(this.userService.getUsers(), { initialValue: [] });
}
