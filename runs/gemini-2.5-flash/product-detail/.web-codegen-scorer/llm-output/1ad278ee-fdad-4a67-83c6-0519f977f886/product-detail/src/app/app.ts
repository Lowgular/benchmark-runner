import { Component, inject } from "@angular/core";
import { CommonModule, CurrencyPipe, NgOptimizedImage } from "@angular/common";
import { toSignal } from "@angular/core/rxjs-interop";

import { ProductService } from "./services/product.service";
import { Product } from "./models/product.model";

@Component({
  selector: "app-root",
  templateUrl: "./app.html",
  styleUrl: "./app.css",
  imports: [CommonModule, CurrencyPipe, NgOptimizedImage],
})
export class App {
  private productService = inject(ProductService);

  product = toSignal<Product>(this.productService.getProduct());
}