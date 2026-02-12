import { Component, computed, inject, signal } from "@angular/core";
import { AsyncPipe, CurrencyPipe, NgIf } from "@angular/common";
import { NgOptimizedImage } from "@angular/common";
import { ProductService } from "./product.service";
import { Product } from "./product.model";

@Component({
  selector: "app-root",
  templateUrl: "./app.html",
  styleUrl: "./app.css",
  imports: [NgIf, AsyncPipe, CurrencyPipe, NgOptimizedImage],
})
export class App {
  private readonly productService = inject(ProductService);

  private readonly productState = signal<Product | null>(null);

  readonly product = computed(() => this.productState());

  constructor() {
    this.productService.getProduct().subscribe((product) => {
      this.productState.set(product);
    });
  }
}
