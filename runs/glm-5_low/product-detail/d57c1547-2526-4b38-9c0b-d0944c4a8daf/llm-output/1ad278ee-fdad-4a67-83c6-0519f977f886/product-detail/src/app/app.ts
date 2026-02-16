import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductService } from './services/product.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  imports: [CommonModule],
})
export class App {
  private productService = inject(ProductService);
  
  product = toSignal(this.productService.getProduct());
}
