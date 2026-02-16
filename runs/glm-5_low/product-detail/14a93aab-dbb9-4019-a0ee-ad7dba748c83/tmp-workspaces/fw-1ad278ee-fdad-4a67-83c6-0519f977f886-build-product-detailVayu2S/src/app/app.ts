import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { ProductService } from './services/product.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  imports: [CurrencyPipe],
})
export class App {
  private readonly productService = inject(ProductService);
  protected readonly product = toSignal(this.productService.getProduct());
}
