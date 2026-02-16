import { Component, inject } from "@angular/core";
import { DatePipe } from "@angular/common";
import { UserService } from "./services/user.service";
import { User } from "./models/user.model";
import { toSignal } from "@angular/core/rxjs-interop";

@Component({
  selector: "app-root",
  templateUrl: "./app.html",
  imports: [DatePipe],
})
export class App {
  private userService = inject(UserService);

  users = toSignal(this.userService.getUsers(), { initialValue: [] });

  formatLastLogin(timestamp: number): string {
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}.${month}.${year}, ${hours}:${minutes}`;
  }
}
