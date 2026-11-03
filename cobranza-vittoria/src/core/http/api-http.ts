import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../config/environment';

@Injectable({ providedIn: 'root' })
export class ApiHttp {
  readonly baseUrl = environment.apiUrl;
  readonly http = inject(HttpClient);
}
