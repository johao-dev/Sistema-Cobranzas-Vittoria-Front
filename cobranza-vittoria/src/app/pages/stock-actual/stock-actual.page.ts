import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  standalone: true,
  selector: 'app-stock-actual-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-actual.page.html',
  styleUrl: './stock-actual.page.css'
})
export class StockActualPage {
}
