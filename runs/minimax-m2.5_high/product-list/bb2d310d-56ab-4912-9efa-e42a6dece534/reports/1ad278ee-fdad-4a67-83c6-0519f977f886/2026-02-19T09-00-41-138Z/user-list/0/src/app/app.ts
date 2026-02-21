import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { UserService } from './services/user.service';
import { User } from './models/user.model';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  imports: [CommonModule, DatePipe],
})
export class App implements OnInit {
  private userService = inject(UserService);

  users = signal<User[]>([]);

  ngOnInit() {
    this.userService.getUsers().subscribe((data) => {
      this.users.set(data);
    });
  }
}
