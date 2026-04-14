import { ChangeDetectionStrategy, Component, OnInit } from "@angular/core";
import { Product } from "./product.model";
import { ProductService } from "./product.service";

@Component({
  selector: "app-root",
  templateUrl: "./app.html",
  styleUrl: "./app.css",
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