import { Component, OnInit, inject } from "@angular/core";
import { Product } from "./product.model";
import { ProductService } from "./product.service";

@Component({
  selector: "app-root",
  templateUrl: "./app.html",
  styleUrl: "./app.css",
  imports: [],
})
export class App implements OnInit {
  product: Product | null = null;

  private productService = inject(ProductService);

  ngOnInit(): void {
    this.productService.getProduct().subscribe((data) => {
      this.product = data;
    });
  }
}import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { Product } from "./product.model";

@Injectable({ providedIn: "root" })
export class ProductService {
  private readonly productUrl =
    "https://storage.googleapis.com/lowgular-platform/mocks/product.json";

  private http = inject(HttpClient);

  getProduct(): Observable<Product> {
    return this.http.get<Product>(this.productUrl);
  }
}