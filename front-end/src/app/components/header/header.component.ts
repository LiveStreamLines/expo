import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { USER_AVATAR, NAV_ICONS } from '../../constants/figma-assets';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnInit, OnDestroy {
  showDropdown = false;
  currentUser = {
    name: 'User',
    role: 'User',
    avatar: USER_AVATAR
  };

  expoLogo = 'assets/images/logos/expo-2030-logo.png';
  chevronIcon = 'assets/images/icons/chevron-down.svg';
  searchIcon = NAV_ICONS.search;
  navIcons = NAV_ICONS;
  
  navItems = [
    { label: 'Home', route: '/projects', iconKey: 'home', active: false },
    { label: 'Monitor', route: '/monitor', iconKey: 'monitor', active: false },
    { label: 'Contact', route: '/contact', iconKey: 'contact', active: false },
    { label: 'Admin', route: '/admin', iconKey: 'settings', active: false }
  ];

  getIconUrl(iconKey: string, isActive: boolean): string {
    const icon = this.navIcons[iconKey as keyof typeof NAV_ICONS];
    if (typeof icon === 'string') {
      return icon; // For search icon
    }
    return isActive ? icon.filled : icon.outline;
  }

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const userProfile = target.closest('.user-profile');
    const dropdown = target.closest('.user-dropdown');
    
    if (!userProfile && !dropdown) {
      this.showDropdown = false;
    }
  }

  ngOnInit() {
    // Load user data from AuthService
    this.loadUserData();

    // Update active state based on current route
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.updateActiveState(event.url);
      });

    // Set initial active state
    this.updateActiveState(this.router.url);
  }

  ngOnDestroy() {
    // Cleanup if needed
  }

  private loadUserData() {
    const user = this.authService.getUser();
    if (user) {
      this.currentUser = {
        name: user.name || user.email || 'User',
        role: user.role || 'User',
        avatar: USER_AVATAR
      };
    }
  }

  toggleDropdown(event: Event) {
    event.stopPropagation();
    this.showDropdown = !this.showDropdown;
  }

  onLogout() {
    this.authService.logout();
    this.showDropdown = false;
    this.router.navigate(['/login']);
  }

  private updateActiveState(url: string) {
    this.navItems.forEach(item => {
      // Home (projects) is active for root path or /projects
      if (item.route === '/projects') {
        item.active = url === '/' || url === '/projects' || url.startsWith('/projects/') || url.startsWith('/project/');
      } else {
        item.active = url === item.route || url.startsWith(item.route + '/');
      }
    });
  }
}

