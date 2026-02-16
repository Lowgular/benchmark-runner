import { Component, inject, signal, toSignal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ProductService } from './product.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  imports: [CurrencyPipe],
})
export class App {
  private readonly productService = inject(ProductService);

  readonly product = toSignal(this.productService.getProduct(), {
    initialValue: null,
  });
}
