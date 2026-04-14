import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { AsyncPipe } from "@angular/common";
import { Product } from "./product.model";
import { ProductService } from "./product.service";

@Component({
  selector: "app-root",
  templateUrl: "./app.html",
  imports: [AsyncPipe],
})
export class App {
  private productService = inject(ProductService);
  product$ = this.productService.getProduct();
}