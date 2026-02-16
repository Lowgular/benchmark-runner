import { Component, computed, inject } from "@angular/core";
import { CurrencyPipe, NgOptimizedImage } from "@angular/common";
import { toSignal } from "@angular/core/rxjs-interop";
import { ProductService } from "./product.service";

@Component({
  selector: "app-root",
  template: "./app.html",
  styleUrl: "./app.css",
  imports: [NgOptimizedImage, CurrencyPipe],
})
export class App {
  private readonly productService = inject(ProductService);

  readonly product = toSignal(this.productService.getProduct(), {
    initialValue: null,
  });

  readonly hasProduct = computed(() => this.product() !== null);
}
