import { User } from "./models/user.model";
import { UserService } from "./services/user.service";
import { Component, OnInit } from "@angular/core";
import { CommonModule, DatePipe } from "@angular/common";

@Component({
  selector: "app-root",
  templateUrl: "./app.html",
  styleUrl: "./app.css",
  imports: [CommonModule],
})
export class App implements OnInit {
  users: User[] = [];

  constructor(
    private userService: UserService,
    private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    this.userService.getUsers().subscribe((users) => {
      this.users = users;
    });
  }

  formatLastLoggedIn(timestamp: number): string {
    const date = new Date(timestamp);
    return this.datePipe.transform(date, "dd.MM.yyyy, HH:mm") || "";
  }
}
