
import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { LoginService } from "./login.service";

@Component({
  selector: "app-root",
  templateUrl: "./app.html",
  styleUrl: "./app.css",
  imports: [FormsModule],
})
export class App {
  private loginService = inject(LoginService);

  email = signal("");
  password = signal("");
  isLoggedIn = signal(false);

  login() {
    const emailValue = this.email();
    const passwordValue = this.password();

    this.loginService.login(emailValue, passwordValue).subscribe(() => {
      this.isLoggedIn.set(true);
    });
  }
}
