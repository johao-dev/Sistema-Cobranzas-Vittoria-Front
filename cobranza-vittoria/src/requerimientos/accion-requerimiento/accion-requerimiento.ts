import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EstadoRequerimientos } from '../estado-requerimientos';
import { DialogoRequerimiento } from '../dialogo-requerimiento/dialogo-requerimiento';

@Component({
  selector: 'accion-requerimiento',
  imports: [FormsModule, DialogoRequerimiento],
  templateUrl: './accion-requerimiento.html',
  styleUrls: ['../presentacion-requerimientos.css', './accion-requerimiento.css'],
})
export class AccionRequerimiento {
  protected readonly vm = inject(EstadoRequerimientos);
}
