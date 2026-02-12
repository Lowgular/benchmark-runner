import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Product } from '../models/product.model';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private http = inject(HttpClient);
  private apiUrl = 'https://storage.googleapis.com/lowgular-platform/mocks/product.json';

  getProduct() {
    return this.http.get<Product>(this.apiUrl);
  }
}