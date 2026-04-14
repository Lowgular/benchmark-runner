import { ChangeDetectionStrategy, Component, inject, OnInit } from "@angular/core";
import { Product } from "./product.model";
import { ProductService } from "./product.service";
import { AsyncPipe } from "@angular/common";

@Component({
  selector: "app-root",
  templateUrl: "./app.html",
  imports: [AsyncPipe],
})
export class App {
  private productService = inject(ProductService);
  product$ = this.productService.getProduct();
}

// Note: If "implements OnInit" was present and used only for the subscription, it has been removed.
// The subscription code inside ngOnInit() is replaced by the observable property 'product$'.
// The template should be updated to use the async pipe accordingly.

// Also, no properties like 'product' (with data) are kept anymore, as the observable is directly exposed.


// No other changes are necessary in this file.

// The new file content:
//
// import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
// import { ProductService } from "./product.service";
// import { AsyncPipe } from "@angular/common";
//
// @Component({
//   selector: "app-root",
//   templateUrl: "./app.html",
//   imports: [AsyncPipe],
// })
// export class App {
//   private productService = inject(ProductService);
//   product$ = this.productService.getProduct();
// }
// 
// And in the app.html template file:
//
// <div class="min-h-screen bg-slate-50 flex items-center justify-center p-6">
//   <div class="w-full max-w-2xl bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
//     <div class="flex flex-col md:flex-row">
//       <div class="md:w-1/3 bg-slate-100 flex items-center justify-center p-6">
//         <img
//           class="h-40 w-40 object-contain"
//           [attr.src]="product$ | async)?.image"
//           [alt]="product$ | async)?.name"
//         />
//       </div>
//       <div class="md:w-2/3 p-6 space-y-4">
//         <h1 class="text-2xl font-semibold text-slate-900">
//           {{ (product$ | async)?.name }}
//         </h1>
//         <p class="text-sm text-slate-600 leading-relaxed">
//           {{ (product$ | async)?.description }}
//         </p>
//         <div class="text-lg font-bold text-slate-900">{{ (product$ | async)?.price }}</div>
//       </div>
//     </div>
//   </div>
// </div>
//