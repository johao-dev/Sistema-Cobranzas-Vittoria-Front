import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  standalone: true,
  selector: 'app-login-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.page.html',
  styleUrl: './login.page.css'
})
export class LoginPage {
  loading = false;
  showPassword = false;
  form = {
    usuarioLogin: '',
    password: ''
  };

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private notifications: NotificationService
  ) {}

  submit(): void {
    if (this.loading) return;

    if (!this.form.usuarioLogin.trim() || !this.form.password.trim()) {
      this.notifications.show('Ingresa tu usuario y contraseña.', 'info');
      return;
    }

    this.loading = true;
    this.auth.login({
      usuarioLogin: this.form.usuarioLogin.trim(),
      password: this.form.password
    }).subscribe({
      next: () => {
        this.loading = false;
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
        this.router.navigateByUrl(returnUrl);
      },
      error: err => {
        this.loading = false;
        this.notifications.show(err?.error?.message || 'Usuario o contraseña incorrectos.', 'error');
      }
    });
  }
}
