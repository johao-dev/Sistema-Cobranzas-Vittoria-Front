import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { TipoCambioResponse } from '../../models/tipo-cambio.models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class SunatService {
  private readonly tipoCambioSubject = new BehaviorSubject<TipoCambioResponse | null>(null);
  private isLoading = false;

  readonly tipoCambio$: Observable<TipoCambioResponse | null> = this.tipoCambioSubject.asObservable();

  constructor(private api: ApiService) {}

  loadTipoCambio(force = false): void {
    if (this.isLoading) return;
    if (!force && this.tipoCambioSubject.value) return;

    this.isLoading = true;
    this.api.http
      .get<TipoCambioResponse>(`${this.api.baseUrl}/api/tipo-cambio`)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (response: TipoCambioResponse) => {
          this.tipoCambioSubject.next(response);
        },
        error: () => {
          this.tipoCambioSubject.next(this.tipoCambioSubject.value);
        }
      });
  }

  get current(): TipoCambioResponse | null {
    return this.tipoCambioSubject.value;
  }
}
