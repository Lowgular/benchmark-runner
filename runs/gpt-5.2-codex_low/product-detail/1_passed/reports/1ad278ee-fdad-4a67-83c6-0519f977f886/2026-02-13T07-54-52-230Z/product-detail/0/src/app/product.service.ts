import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { Product } from "./product.model";

@Injectable({ providedIn: "root" })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly endpoint =
    "https://storage.googleapis.com/lowgular-platform/mocks/product.json";

  getProduct(): Observable<Product> {
    return this.http.get<Product>(this.endpoint);
  }
}
