import { Component, computed, inject } from "@angular/core";
import { NgOptimizedImage } from "@angular/common";
import { toSignal } from "@angular/core/rxjs-interop";
import { ProductService } from "./product.service";

@Component({
  selector: "app-root",
  templateUrl: "./app.html",
  styleUrl: "./app.css",
  imports: [NgOptimizedImage],
})
export class App {
  private readonly productService = inject(ProductService);
  readonly product = toSignal(this.productService.getProduct(), {
    initialValue: null,
  });

  readonly formattedPrice = computed(() => {
    const value = this.product()?.price;
    if (value === null || value === undefined) {
      return "$0.00";
    }
    return `$${value.toFixed(2)}`;
  });
}
