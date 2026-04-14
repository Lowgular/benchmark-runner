import { ChangeDetectionStrategy, Component, OnInit, inject } from "@angular/core";
import { Product } from "./product.model";
import { ProductService } from "./product.service";
import { AsyncPipe } from "@angular/common";

@Component({
  selector: "app-root",
  templateUrl: "./app.html",
  standalone: true,
  imports: [AsyncPipe],
})
export class App {
  private productService = inject(ProductService);
  product$ = this.productService.getProduct();
}