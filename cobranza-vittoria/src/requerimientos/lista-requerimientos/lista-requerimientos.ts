import { FlujoRequerimiento } from '../flujo-requerimiento/flujo-requerimiento';
import { ItemsAlmacenRequerimiento } from '../items-almacen-requerimiento/items-almacen-requerimiento';
import { EdicionItemRequerimiento } from '../edicion-item-requerimiento/edicion-item-requerimiento';
import { BorradorRequerimiento } from '../borrador-requerimiento/borrador-requerimiento';
import { ConsultaRequerimientos } from '../consulta-requerimientos/consulta-requerimientos';
import { ReferenciasRequerimiento } from '../referencias-requerimiento/referencias-requerimiento';
import { PartidasRequerimiento } from '../partidas-requerimiento';
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EstadoRequerimientos } from '../estado-requerimientos';
import { DetalleRequerimiento } from '../detalle-requerimiento/detalle-requerimiento';
import { AccionRequerimiento } from '../accion-requerimiento/accion-requerimiento';
import { FormularioRequerimiento } from '../formulario-requerimiento/formulario-requerimiento';
import { FormularioItem } from '../formulario-item/formulario-item';
import { NuevoMaterial } from '../nuevo-material/nuevo-material';

@Component({
  selector: 'lista-requerimientos',
  imports: [
    CommonModule,
    FormsModule,
    DetalleRequerimiento,
    AccionRequerimiento,
    FormularioRequerimiento,
    FormularioItem,
    NuevoMaterial,
  ],
  providers: [
    EstadoRequerimientos,
    PartidasRequerimiento,
    ReferenciasRequerimiento,
    ConsultaRequerimientos,
    BorradorRequerimiento,
    EdicionItemRequerimiento,
    ItemsAlmacenRequerimiento,
    FlujoRequerimiento,
  ],
  templateUrl: './lista-requerimientos.html',
  styleUrls: ['../presentacion-requerimientos.css', './lista-requerimientos.css'],
})
export class ListaRequerimientos implements OnInit {
  protected readonly vm = inject(EstadoRequerimientos);

  ngOnInit(): void {
    this.vm.iniciar();
  }
}
