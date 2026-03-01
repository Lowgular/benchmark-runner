import { NgIf } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal,
} from "@angular/core";
import { Product } from "./product.model";
import { ProductService } from "./product.service";

@Component({
  selector: "app-product-card",
  template: `<h1 *ngIf="product() as product">{{ product.name }}</h1>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIf],
})
export class App implements OnInit {
  product = signal<Product | null>(null);

  constructor(private productService: ProductService) {}

  ngOnInit(): void {
    this.productService.getProduct().subscribe((data) => {
      this.product.set(data);
    });
  }
}
