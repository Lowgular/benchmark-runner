import { Component, inject, OnInit } from "@angular/core";
import { Product } from "./product.model";
import { ProductService } from "./product.service";

@Component({
  selector: "app-root",
  templateUrl: "./app.html",
})
export class App implements OnInit {
  private productService = inject(ProductService);
  product: Product | null = null;

  ngOnInit(): void {
    this.productService.getProduct().subscribe((data) => {
      this.product = data;
    });
  }
}
