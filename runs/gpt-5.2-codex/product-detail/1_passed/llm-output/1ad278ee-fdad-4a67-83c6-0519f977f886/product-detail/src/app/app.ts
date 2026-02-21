import { Component, computed, inject } from "@angular/core";
import { CommonModule, CurrencyPipe } from "@angular/common";
import { toSignal } from "@angular/core/rxjs-interop";
import { NgOptimizedImage } from "@angular/common";
import { ProductService } from "./product.service";
import { Product } from "./product.model";

@Component({
  selector: "app-root",
  templateUrl: "./app.html",
  styleUrl: "./app.css",
  imports: [CommonModule, NgOptimizedImage, CurrencyPipe],
})
export class App {
  private readonly productService = inject(ProductService);
  readonly product = toSignal<Product>(this.productService.getProduct());
  readonly formattedPrice = computed(() => {
    const product = this.product();
    return product ? product.price : 0;
  });
}
