import { ChangeDetectionStrategy, Component, OnInit } from "@angular/core";
import { Product } from "./product.model";
import { ProductService } from "./product.service";
import { NgOptimizedImage } from "@angular/common";

@Component({
  selector: "app-root",
  templateUrl: "./app.html",
  styleUrl: "./app.css",
  changeDetection: ChangeDetectionStrategy.Default,
  standalone: true,
  imports: [NgOptimizedImage],
})
export class App implements OnInit {
  product: Product | null = null;

  constructor(private productService: ProductService) {}

  ngOnInit(): void {
    this.productService.getProduct().subscribe((data) => {
      this.product = data;
    });
  }
}
