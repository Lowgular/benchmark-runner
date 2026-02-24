import { Component, OnInit } from "@angular/core";
import { CommonModule, DatePipe } from "@angular/common";
import { UserService } from "./services/user.service";
import { User } from "./models/user.model";

@Component({
  selector: "app-root",
  templateUrl: "./app.html",
  styleUrl: "./app.css",
  imports: [CommonModule],
  providers: [DatePipe],
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
    return this.datePipe.transform(timestamp, "dd.MM.yyyy, HH:mm") ?? "";
  }
}
