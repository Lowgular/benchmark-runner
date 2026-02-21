import { Component, computed, inject } from "@angular/core";
import { DatePipe, NgOptimizedImage } from "@angular/common";
import { toSignal } from "@angular/core/rxjs-interop";
import { UserService } from "./services/user.service";
import { User } from "./models/user";

@Component({
  selector: "app-root",
  templateUrl: "./app.html",
  styleUrl: "./app.css",
  imports: [NgOptimizedImage, DatePipe],
})
export class App {
  private readonly userService = inject(UserService);

  readonly users = toSignal(this.userService.getUsers(), {
    initialValue: [] as User[],
  });

  readonly totalUsers = computed(() => this.users().length);
}
