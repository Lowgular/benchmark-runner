import { Product } from "./product.model";
import { ProductService } from "./product.service";
import { Component, ChangeDetectionStrategy, OnInit } from "@angular/core";
import { NgOptimizedImage } from "@angular/common";

@Component({
  selector: "app-root",
  templateUrl: "./app.html",
  styleUrl: "./app.css",
  standalone: true,
  imports: [NgOptimizedImage, Component, ChangeDetectionStrategy],
  changeDetection: ChangeDetectionStrategy.Default,
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
