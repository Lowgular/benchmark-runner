import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Product } from '../models/product.model';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private http = inject(HttpClient);
  private readonly apiUrl = 'https://storage.googleapis.com/lowgular-platform/mocks/product.json';

  getProduct(): Observable<Product> {
    return this.http.get<Product>(this.apiUrl);
  }
}
