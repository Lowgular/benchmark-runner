import { Component, inject } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { ProductService } from './services/product.service';
import { Product } from './models/product.model';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  imports: [JsonPipe],
})
export class App {
  private productService = inject(ProductService);
  product: Product | undefined;

  constructor() {
    this.productService.getProduct().subscribe((data) => {
      this.product = data;
    });
  }
}
