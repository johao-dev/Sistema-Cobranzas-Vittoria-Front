import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EstadoRequerimientos } from '../estado-requerimientos';
import { DialogoModal } from '../../shared/dialogos/dialogo-modal';

@Component({
  selector: 'accion-requerimiento',
  imports: [FormsModule, DialogoModal],
  templateUrl: './accion-requerimiento.html',
  styleUrls: ['../presentacion-requerimientos.css', './accion-requerimiento.css'],
})
export class AccionRequerimiento {
  protected readonly vm = inject(EstadoRequerimientos);
}
