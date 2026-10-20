import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EstadoRequerimientos } from '../estado-requerimientos';
import { DialogoModal } from '../../shared/dialogos/dialogo-modal';

@Component({
  selector: 'detalle-requerimiento',
  imports: [CommonModule, FormsModule, DialogoModal],
  templateUrl: './detalle-requerimiento.html',
  styleUrls: ['../presentacion-requerimientos.css', './detalle-requerimiento.css'],
})
export class DetalleRequerimiento {
  protected readonly vm = inject(EstadoRequerimientos);
}
