import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { SunatService } from '../../../core/services/sunat.service';

@Component({
  selector: 'app-tipo-cambio',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tipo-cambio.component.html',
  styleUrl: './tipo-cambio.component.css'
})
export class TipoCambioComponent implements OnInit {
  private readonly sunatService = inject(SunatService);
  readonly tipoCambio$ = this.sunatService.tipoCambio$;

  ngOnInit(): void {
    this.sunatService.loadTipoCambio();
  }

  formatFecha(fecha: string | null | undefined): string {
    if (!fecha) return '--/--/----';
    const date = new Date(fecha);
    if (Number.isNaN(date.getTime())) return fecha;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
}
