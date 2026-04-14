import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { Observable } from "rxjs";
import { Product } from "./product.model";

@Injectable()
export class ProductService {
  private readonly productUrl =
    "https://storage.googleapis.com/lowgular-platform/mocks/product.json";

  private http = inject(HttpClient);

  getProduct(): Observable<Product> {
    return this.http.get<Product>(this.productUrl);
  }
}