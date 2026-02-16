import { Component, signal } from "@angular/core";
import { ReactiveFormsModule, FormBuilder, Validators } from "@angular/forms";
import { take } from "rxjs";
import { AuthService } from "./services/auth.service";
import { LoginRequest } from "./models/login.model";

@Component({
  selector: "app-root",
  templateUrl: "./app.html",
  styleUrl: "./app.css",
  imports: [ReactiveFormsModule],
})
export class App {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  protected readonly successMessage = signal<string | null>(null);
  protected readonly accessToken = signal<string | null>(null);

  protected readonly form = this.formBuilder.nonNullable.group({
    email: ["", [Validators.required, Validators.email]],
    password: ["", [Validators.required]],
  });

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload: LoginRequest = this.form.getRawValue();

    this.authService
      .login(payload)
      .pipe(take(1))
      .subscribe((response) => {
        this.accessToken.set(response.accessToken);
        this.successMessage.set("logged in successfully");
      });
  }
}
