import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  standalone: true,
  selector: 'app-kardex-salidas-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './kardex-salidas.page.html',
  styleUrl: './kardex-salidas.page.css'
})
export class KardexSalidasPage {
}
