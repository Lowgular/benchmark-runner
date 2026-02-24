import { Component, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { LoginService } from "./login.service";
import { LoginRequest } from "./login.model";

@Component({
  selector: "app-root",
  templateUrl: "./app.html",
  styleUrl: "./app.css",
  imports: [ReactiveFormsModule],
})
export class App {
  readonly loginForm = new FormGroup({
    email: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  readonly isLoggedIn = signal(false);
  readonly loginMessage = signal("");

  readonly loginService = inject(LoginService);

  onSubmit() {
    if (this.loginForm.invalid) {
      return;
    }

    const request: LoginRequest = {
      email: this.loginForm.controls.email.value,
      password: this.loginForm.controls.password.value,
    };

    this.loginService.login(request).subscribe((response) => {
      this.isLoggedIn.set(true);
      this.loginMessage.set("logged in successfully");
    });
  }
}
import { Component, inject, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { LoginService } from "./login.service";
import { LoginRequest } from "./login.model";

@Component({
  selector: "app-root",
  templateUrl: "./app.html",
  styleUrl: "./app.css",
  imports: [ReactiveFormsModule],
})
export class App {
  readonly loginForm = new FormGroup({
    email: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  readonly isLoggedIn = signal(false);
  readonly loginMessage = signal("");

  readonly loginService = inject(LoginService);

  onSubmit() {
    if (this.loginForm.invalid) {
      return;
    }

    const request: LoginRequest = {
      email: this.loginForm.controls.email.value,
      password: this.loginForm.controls.password.value,
    };

    this.loginService.login(request).subscribe((response) => {
      this.isLoggedIn.set(true);
      this.loginMessage.set("logged in successfully");
    });
  }
}
