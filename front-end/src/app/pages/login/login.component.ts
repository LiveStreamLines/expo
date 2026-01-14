import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  email: string = 'amar@livestreamlines.com';
  password: string = 'interQAZ@159';
  isLoading: boolean = false;
  error: string | null = null;
  showPassword: boolean = false;
  expoLogoUrl = "url('assets/images/logos/expo-2030-logo.png')";

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    console.log('Login component initialized');
    // If already authenticated, redirect to projects
    if (this.authService.isAuthenticated()) {
      console.log('Already authenticated, redirecting to projects');
      this.router.navigate(['/projects']);
    } else {
      console.log('Not authenticated, showing login form');
    }
  }

  onSubmit() {
    if (!this.email || !this.password) {
      this.error = 'Please enter both email and password';
      return;
    }

    this.isLoading = true;
    this.error = null;

    this.authService.login(this.email, this.password).subscribe({
      next: (response) => {
        this.isLoading = false;
        // Check if phone verification is required
        if (response.phoneRequired) {
          this.error = response.msg || 'Phone verification required. Please contact your administrator.';
          return;
        }
        
        if (response.authh) {
          // Login successful, redirect to projects
          this.router.navigate(['/projects']);
        } else {
          this.error = 'Login failed: No authentication token received';
        }
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 401) {
          this.error = err.error?.msg || 'Invalid email or password. Please try again.';
        } else if (err.status === 403) {
          this.error = err.error?.msg || 'Your account is inactive. Please contact your administrator.';
        } else if (err.error && err.error.msg) {
          this.error = err.error.msg;
        } else {
          this.error = 'Login failed. Please check your connection and try again.';
        }
        console.error('Login error:', err);
      }
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }
}
