import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Notificaciones } from '../notificaciones';

@Component({
  selector: 'aviso-notificacion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './aviso-notificacion.html',
  styleUrl: './aviso-notificacion.css',
})
export class AvisoNotificacion {
  protected readonly state = inject(Notificaciones).state;
}
