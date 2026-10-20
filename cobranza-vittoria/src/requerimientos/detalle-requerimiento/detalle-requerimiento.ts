import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EstadoRequerimientos } from '../estado-requerimientos';
import { DialogoRequerimiento } from '../dialogo-requerimiento/dialogo-requerimiento';

@Component({
  selector: 'detalle-requerimiento',
  imports: [CommonModule, FormsModule, DialogoRequerimiento],
  templateUrl: './detalle-requerimiento.html',
  styleUrls: ['../presentacion-requerimientos.css', './detalle-requerimiento.css'],
})
export class DetalleRequerimiento {
  protected readonly vm = inject(EstadoRequerimientos);
}
