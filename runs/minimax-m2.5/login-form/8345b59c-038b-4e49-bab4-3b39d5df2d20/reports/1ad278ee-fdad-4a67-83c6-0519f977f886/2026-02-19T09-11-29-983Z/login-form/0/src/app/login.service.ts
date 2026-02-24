import { HttpClient } from "@angular/common/http";
import { inject } from "@angular/core";
import { Observable } from "rxjs";
import { LoginRequest, LoginResponse } from "./login.model";

@injectable({
  providedIn: "root",
})
export class LoginService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl =
    "https://us-central1-lowgular-platform-c0e93.cloudfunctions.net/api/mock/login";

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.apiUrl, request);
  }
}
