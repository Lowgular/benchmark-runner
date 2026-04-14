import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { Product } from "./product.model";

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private readonly productUrl =
    "https://storage.googleapis.com/lowgular-platform/mocks/product.json";

  constructor(private http: HttpClient) {}

  getProduct(): Observable<Product> {
    return this.http.get<Product>(this.productUrl);
  }
}
