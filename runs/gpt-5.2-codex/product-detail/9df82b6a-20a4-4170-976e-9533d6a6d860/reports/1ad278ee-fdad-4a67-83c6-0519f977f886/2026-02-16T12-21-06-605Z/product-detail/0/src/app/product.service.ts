import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { Product } from "./product.model";

@Injectable({
  providedIn: "root",
})
export class ProductService {
  private readonly http = inject(HttpClient);

  getProduct(): Observable<Product> {
    return this.http.get<Product>(
      "https://storage.googleapis.com/lowgular-platform/mocks/product.json"
    );
  }
}
