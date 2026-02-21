import { Component, inject } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ProductService } from './services/product.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, CurrencyPipe],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly productService = inject(ProductService);
  product = toSignal(this.productService.getProduct());
}