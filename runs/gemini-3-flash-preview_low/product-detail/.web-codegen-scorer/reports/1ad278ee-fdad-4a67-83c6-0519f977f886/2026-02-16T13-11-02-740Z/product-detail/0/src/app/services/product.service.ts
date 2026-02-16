import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product } from '../models/product.model';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'https://storage.googleapis.com/lowgular-platform/mocks/product.json';

  getProduct(): Observable<Product> {
    return this.http.get<Product>(this.apiUrl);
  }
}