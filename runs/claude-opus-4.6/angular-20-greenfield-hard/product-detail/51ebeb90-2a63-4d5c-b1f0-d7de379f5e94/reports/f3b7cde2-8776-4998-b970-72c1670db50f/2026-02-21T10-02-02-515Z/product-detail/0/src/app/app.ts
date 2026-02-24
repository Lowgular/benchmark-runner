import { Component, OnInit, inject } from '@angular/core';
import { ProductService } from './services/product.service';
import { Product } from './models/product.model';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly productService = inject(ProductService);

  product: Product | null = null;
  formattedPrice = '';

  ngOnInit(): void {
    this.productService.getProduct().subscribe((product) => {
      this.product = product;
      this.formattedPrice = `$${product.price.toFixed(2)}`;
    });
  }
}
