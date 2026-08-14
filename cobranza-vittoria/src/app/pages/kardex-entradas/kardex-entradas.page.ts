import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  standalone: true,
  selector: 'app-kardex-entradas-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './kardex-entradas.page.html',
  styleUrl: './kardex-entradas.page.css'
})
export class KardexEntradasPage {
}
