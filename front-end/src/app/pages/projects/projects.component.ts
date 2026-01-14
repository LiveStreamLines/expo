import { Component, Input, OnInit, OnChanges, AfterViewInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
/// <reference types="google.maps" />
import { PROJECT_IMAGE, ICONS, COMMUNITY_IMAGES } from '../../constants/figma-assets';
import { ProjectsService } from '../../services/projects.service';
import { ServiceConfigService, ServiceConfig } from '../../services/service-config.service';
import { CommunitiesService } from '../../services/communities.service';
import { CamerasService } from '../../services/cameras.service';
import { CameraPicsService } from '../../services/camera-pics.service';
import { CameraPicsCacheService } from '../../services/camera-pics-cache.service';
import { Project } from '../../models/project.model';
import { Camera } from '../../models/camera.model';
import { API_CONFIG } from '../../config/api.config';
import { MAP_THEMES, DEFAULT_MAP_THEME, MapTheme } from '../../config/map-themes.config';

export interface ProjectServiceStatus {
  timelapse: boolean;
  live: boolean;
  drone: boolean;
  photography: boolean;
  satellite: boolean;
}

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.css'
})
export class ProjectsComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() selectedCategory: string = 'Dubai Hills Estate';
  @Input() developerId: string = '';
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;
  
  viewMode: 'list' | 'map' = 'list';
  communityImage: string = '';
  
  icons = ICONS;
  mapTheme: string = DEFAULT_MAP_THEME;
  availableThemes = MAP_THEMES;
  projects: Project[] = [];
  
  projectCameras: Map<string, Camera[]> = new Map();
  projectServiceStatuses: Map<string, ProjectServiceStatus> = new Map();
  serviceConfig: ServiceConfig | null = null;
  isLoading = false;
  error: string | null = null;
  hoveredService: { projectId: string; service: string } | null = null;
  tooltipPositions: Map<string, { left: string; transform: string }> = new Map();
  
  private map: google.maps.Map | null = null;
  private markers: google.maps.Marker[] = [];
  private cameraMarkers: google.maps.Marker[] = [];
  
  selectedMapCamera: Camera | null = null;
  selectedMapProject: Project | null = null;
  thumbnailCardPosition: { x: number; y: number } = { x: 0, y: 0 };

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient,
    private projectsService: ProjectsService,
    private serviceConfigService: ServiceConfigService,
    private communitiesService: CommunitiesService,
    private camerasService: CamerasService,
    private cameraPicsService: CameraPicsService,
    private cacheService: CameraPicsCacheService,
    private cdr: ChangeDetectorRef
  ) {}

  // Helper methods
  isListView(): boolean {
    return this.viewMode === 'list';
  }
  
  isMapView(): boolean {
    return this.viewMode === 'map';
  }
  
  getThemeKeys(): string[] {
    return Object.keys(MAP_THEMES);
  }

  toggleView(mode: 'list' | 'map'): void {
    if (this.viewMode === mode) return;
    
    // Clean up map if switching away from map view
    if (this.viewMode === 'map' && mode === 'list') {
      this.cleanupMap();
    }
    
    this.viewMode = mode;
    this.cdr.detectChanges();
    
    // If switching to map view, initialize map after Angular renders the view
    if (mode === 'map' && !this.map) {
      // Wait for *ngIf to create the element and Angular to render it
      setTimeout(() => {
        this.initializeMap();
      }, 100);
    } else if (mode === 'map' && this.map) {
      // Map already initialized, trigger resize
      setTimeout(() => {
        if (this.map) {
          google.maps.event.trigger(this.map, 'resize');
        }
      }, 100);
    }
  }

  ngOnInit() {
    if (this.selectedCategory) {
      this.communityImage = COMMUNITY_IMAGES[this.selectedCategory as keyof typeof COMMUNITY_IMAGES] || COMMUNITY_IMAGES['Dubai Hills Estate'] || '';
    }
    
    // Check if developerId is provided via query params or input (for backward compatibility)
    this.route.queryParams.subscribe(params => {
      if (params['developerId']) {
        this.developerId = params['developerId'];
        this.loadCommunityName();
        this.loadProjects();
      } else if (this.developerId) {
        this.loadCommunityName();
        this.loadProjects();
      } else {
        // No developerId provided - automatically use the first (and only) developer
        this.loadFirstDeveloper();
      }
    });
  }

  private loadFirstDeveloper() {
    this.isLoading = true;
    this.communitiesService.getCommunities().subscribe({
      next: (communities) => {
        if (communities && communities.length > 0) {
          // Use the first developer
          this.developerId = communities[0].id;
          this.selectedCategory = communities[0].name;
          this.communityImage = communities[0].image || COMMUNITY_IMAGES[this.selectedCategory as keyof typeof COMMUNITY_IMAGES] || COMMUNITY_IMAGES['Dubai Hills Estate'] || '';
          this.loadProjects();
        } else {
          this.error = 'No developer found. Please contact your administrator.';
          this.isLoading = false;
          this.projects = [];
        }
      },
      error: (err) => {
        console.error('Error loading developers:', err);
        this.error = 'Failed to load developer information. Please try again later.';
        this.isLoading = false;
        this.projects = [];
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.selectedCategory) {
      this.communityImage = COMMUNITY_IMAGES[this.selectedCategory as keyof typeof COMMUNITY_IMAGES] || COMMUNITY_IMAGES['Dubai Hills Estate'] || '';
    }
    
    if (this.developerId && !this.route.snapshot.queryParams['developerId']) {
      this.loadCommunityName();
      this.loadProjects();
    } else if (!this.developerId && !this.route.snapshot.queryParams['developerId']) {
      // If no developerId is set, load the first developer
      this.loadFirstDeveloper();
    }
  }

  ngAfterViewInit(): void {
    // If default view is map, initialize it
    if (this.viewMode === 'map') {
      setTimeout(() => {
        this.initializeMap();
      }, 200);
    }
  }

  ngOnDestroy() {
    this.cleanupMap();
  }

  private loadCommunityName() {
    if (this.developerId) {
      this.communitiesService.getCommunityById(this.developerId).subscribe({
        next: (community) => {
          this.selectedCategory = community.name;
          this.communityImage = community.image || COMMUNITY_IMAGES[community.name as keyof typeof COMMUNITY_IMAGES] || COMMUNITY_IMAGES['Dubai Hills Estate'] || '';
        },
        error: (err) => {
          console.error('Error loading community name:', err);
          this.communityImage = COMMUNITY_IMAGES[this.selectedCategory as keyof typeof COMMUNITY_IMAGES] || COMMUNITY_IMAGES['Dubai Hills Estate'] || '';
        }
      });
    }
  }

  private loadProjects() {
    if (!this.developerId) {
      this.projects = [];
      return;
    }

    this.isLoading = true;
    this.error = null;

    console.log('Loading projects for developerId:', this.developerId);
    
    forkJoin({
      projects: this.projectsService.getProjectsByDeveloperId(this.developerId),
      serviceConfig: this.serviceConfigService.getServiceConfig()
    }).subscribe({
      next: ({ projects, serviceConfig }) => {
        console.log('Projects received:', projects);
        this.serviceConfig = serviceConfig;
        
        this.projects = projects.map(project => {
          const progress = this.calculateProjectProgress(project);
          return {
            ...project,
            image: project.image || PROJECT_IMAGE,
            daysCompleted: progress.daysCompleted,
            totalDays: progress.totalDays
          };
        });

        console.log('Processed projects:', this.projects);
        this.updateProjectServiceStatuses();
        this.loadCamerasForProjects();
        this.isLoading = false;
        
        if (this.viewMode === 'map' && this.map) {
          setTimeout(() => this.updateMap(), 100);
        }
      },
      error: (err) => {
        console.error('Error loading projects:', err);
        console.error('Error details:', err.error, err.status, err.statusText);
        this.error = 'Failed to load projects. Please try again later.';
        this.isLoading = false;
        this.projects = [];
      }
    });
  }

  private calculateProjectProgress(project: Project): { daysCompleted: number; totalDays: number } {
    const THREE_YEARS_DAYS = 1095;
    const totalDays = THREE_YEARS_DAYS;

    if (!project.createdDate) {
      return { daysCompleted: 0, totalDays };
    }

    try {
      const createdDate = new Date(project.createdDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      createdDate.setHours(0, 0, 0, 0);

      const timeDiff = today.getTime() - createdDate.getTime();
      const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const daysCompleted = Math.max(0, Math.min(daysDiff, totalDays));

      return { daysCompleted, totalDays };
    } catch (error) {
      console.error('Error calculating project progress:', error);
      return { daysCompleted: 0, totalDays };
    }
  }

  getProgressPercentage(daysCompleted: number = 0, totalDays: number = 0): number {
    if (totalDays === 0) return 0;
    const percentage = (daysCompleted / totalDays) * 100;
    return Math.max(0, Math.min(100, percentage));
  }

  private updateProjectServiceStatuses() {
    if (!this.serviceConfig) return;

    this.projectServiceStatuses.clear();
    
    this.projects.forEach(project => {
      const status: ProjectServiceStatus = {
        timelapse: true,
        live: this.serviceConfigService.isServiceActive(project.projectTag, 'live', this.serviceConfig!),
        drone: this.serviceConfigService.isServiceActive(project.projectTag, 'drone', this.serviceConfig!),
        photography: this.serviceConfigService.isServiceActive(project.projectTag, 'photography', this.serviceConfig!),
        satellite: false
      };
      this.projectServiceStatuses.set(project.id, status);
    });
  }

  private loadCamerasForProjects() {
    this.projectCameras.clear();
    
    const cameraRequests = this.projects.map(project => 
      this.camerasService.getCamerasByProjectId(project.id).pipe(
        map(cameras => ({ projectId: project.id, cameras })),
        catchError(() => of({ projectId: project.id, cameras: [] }))
      )
    );

    if (cameraRequests.length === 0) return;

    forkJoin(cameraRequests).subscribe({
      next: (results) => {
        results.forEach(({ projectId, cameras }) => {
          cameras.forEach(camera => {
            if (camera.createdDate) {
              camera.installedDate = this.formatDateString(camera.createdDate);
            } else {
              camera.installedDate = 'N/A';
            }
            camera.image = null;
            camera.thumbnail = null;
          });
          this.projectCameras.set(projectId, cameras);
          
          const project = this.projects.find(p => p.id === projectId);
          if (project) {
            this.loadCameraImagesForProject(project, cameras);
          }
        });
        
        if (this.viewMode === 'map' && this.map) {
          setTimeout(() => this.updateMap(), 100);
        }
      },
      error: (err) => {
        console.error('Error loading cameras:', err);
      }
    });
  }

  private loadCameraImagesForProject(project: Project, cameras: Camera[]) {
    if (!project.developer || !project.projectTag) return;

    this.http.get<{ developerTag: string }>(`${API_CONFIG.baseUrl}/api/developers/${project.developer}`).subscribe({
      next: (developer) => {
        const developerTag = developer.developerTag || '';
        const projectTag = project.projectTag || '';

          cameras.forEach(camera => {
            const cameraId = camera.camera || camera.id;
            
            // Load image directly - getLastImageUrl returns Observable<string>
            this.cameraPicsService.getLastImageUrl(developerTag, projectTag, cameraId).subscribe({
              next: (imageUrl) => {
                if (imageUrl) {
                  camera.image = imageUrl;
                  camera.thumbnail = imageUrl;
                }
              },
              error: (err) => {
                // Silently fail - camera image is optional
              }
            });
          });
      },
      error: (err) => {
        console.error('Error loading developer tag:', err);
      }
    });
  }

  private formatDateString(dateString: string): string {
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (error) {
      return 'N/A';
    }
  }

  // Service status methods
  getServiceStatus(projectId: string | null | undefined, service: keyof ProjectServiceStatus): boolean {
    if (!projectId) return false;
    const status = this.projectServiceStatuses.get(projectId);
    return status ? status[service] : false;
  }

  getServiceName(service: string | null | undefined): string {
    const serviceKey = service || '';
    const names: { [key: string]: string } = {
      'timelapse': 'Time laps',
      'live': 'Live',
      'drone': 'Drone',
      'photography': 'Photography',
      'satellite': 'Satellite'
    };
    return names[serviceKey] || serviceKey;
  }

  onServiceHover(projectId: string, service: string, event: MouseEvent) {
    event.stopPropagation();
    this.hoveredService = { projectId, service };
    
    const style = this.getTooltipStyle(event);
    const key = `${projectId}-${service}`;
    this.tooltipPositions.set(key, style);
  }

  onServiceLeave() {
    this.hoveredService = null;
  }

  isServiceHovered(projectId: string | null | undefined, service: string | null | undefined): boolean {
    if (!projectId || !service) return false;
    return this.hoveredService?.projectId === projectId && this.hoveredService?.service === service;
  }

  getTooltipStyle(event: MouseEvent): { left: string; transform: string } {
    const button = event.currentTarget as HTMLElement;
    const card = button.closest('.project-card') as HTMLElement;
    
    if (!button || !card) {
      return { left: '0', transform: 'translateX(0)' };
    }

    const buttonRect = button.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const buttonLeftRelative = buttonRect.left - cardRect.left;
    const cardWidth = cardRect.width;
    const leftPercent = (buttonLeftRelative / cardWidth) * 100;
    
    return {
      left: `${leftPercent}%`,
      transform: 'translateX(0)'
    };
  }

  getTooltipStyleForService(projectId: string, service: string): { left: string; transform: string } {
    const key = `${projectId}-${service}`;
    return this.tooltipPositions.get(key) || { left: '50%', transform: 'translateX(-50%)' };
  }

  // Navigation methods
  navigateToProject(projectId: string) {
    this.router.navigate(['/project', projectId]);
  }

  navigateToAllProjects() {
    this.router.navigate(['/projects']);
  }

  navigateToCamera(cameraId: string, event: Event) {
    event.stopPropagation();
    this.router.navigate(['/camera', cameraId]);
  }

  // Map methods
  setMapTheme(themeKey: string | null | undefined) {
    const key = themeKey || DEFAULT_MAP_THEME;
    if (MAP_THEMES[key]) {
      this.mapTheme = key;
      if (this.map) {
        const theme = MAP_THEMES[key];
        const mapTypeIdStr = theme.mapTypeId || 'satellite';
        const mapTypeId = mapTypeIdStr === 'satellite' 
          ? google.maps.MapTypeId.SATELLITE 
          : google.maps.MapTypeId.ROADMAP;
        this.map.setMapTypeId(mapTypeId);
      }
    }
  }

  /**
   * Initialize the map - simple approach with *ngIf
   * The map container only exists in DOM when isMapView() is true
   * Since it's created fresh, it should have proper dimensions from CSS
   */
  private initializeMap(): void {
    if (this.map) {
      console.warn('Map already initialized!');
      return;
    }

    if (!this.isMapView()) {
      console.log('Not in map view, skipping initialization');
      return;
    }

    // Wait for Angular to render the map container (it's created by *ngIf)
    // Use requestAnimationFrame to wait for browser to render
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = this.mapContainer?.nativeElement || document.querySelector('.map-container') as HTMLElement;
        
        if (!container) {
          console.error('Map container not found! Element may not be rendered yet.');
          // Retry once more after a longer delay
          setTimeout(() => {
            const retryContainer = this.mapContainer?.nativeElement || document.querySelector('.map-container') as HTMLElement;
            if (retryContainer) {
              this.createMap(retryContainer);
            } else {
              console.error('Map container still not found after retry!');
            }
          }, 300);
          return;
        }

        // Container exists, wait a bit for flex layout to calculate dimensions
        setTimeout(() => {
          this.createMap(container);
        }, 50);
      });
    });
  }

  /**
   * Actually create the Leaflet map instance
   * Container is created fresh by *ngIf, so it should have dimensions from CSS flex layout
   */
  private createMap(container: HTMLElement): void {
    if (this.map) {
      console.warn('Map already exists!');
      return;
    }

    // Check dimensions - with *ngIf and flex layout, container should have dimensions
    let width = container.offsetWidth || container.clientWidth || 0;
    let height = container.offsetHeight || container.clientHeight || 0;

    console.log('Creating map - initial container dimensions:', width, 'x', height);

    // If dimensions are 0, wait for flex layout to calculate
    if (!width || !height) {
      console.warn('Container has 0 dimensions, waiting for flex layout...');
      
      // Wait a bit more for flex layout to calculate
      setTimeout(() => {
        width = container.offsetWidth || container.clientWidth || 0;
        height = container.offsetHeight || container.clientHeight || 0;
        
        console.log('After wait - container dimensions:', width, 'x', height);

        // If still 0, calculate from viewport and set explicit dimensions
        if (!width || !height) {
          const viewportHeight = window.innerHeight - 80;
          const viewportWidth = window.innerWidth;
          const header = document.querySelector('.page-header') as HTMLElement;
          const headerHeight = header ? header.offsetHeight : 100;
          
          const calculatedHeight = Math.max(600, viewportHeight - headerHeight - 48);
          const calculatedWidth = viewportWidth - 240;

          console.warn('Container still has 0 dimensions! Setting explicit dimensions:', calculatedWidth, 'x', calculatedHeight);

          // Set explicit dimensions on both wrapper and container
          const wrapper = container.closest('.map-view-wrapper') as HTMLElement;
          if (wrapper) {
            wrapper.style.height = (viewportHeight - headerHeight) + 'px';
            wrapper.style.minHeight = '600px';
          }
          
          container.style.height = calculatedHeight + 'px';
          container.style.width = calculatedWidth + 'px';
          container.style.minHeight = calculatedHeight + 'px';
          
          // Force reflow
          container.offsetHeight;
          wrapper?.offsetHeight;
          container.getBoundingClientRect();
          
          // Re-check dimensions
          width = container.offsetWidth || container.clientWidth || calculatedWidth;
          height = container.offsetHeight || container.clientHeight || calculatedHeight;
          
          console.log('After explicit dimensions - actual:', width, 'x', height);
        }

        // Proceed with initialization (use calculated dimensions as fallback if needed)
        const finalWidth = width || (window.innerWidth - 240);
        const finalHeight = height || Math.max(600, window.innerHeight - 100 - 48);
        
        this.initializeGoogleMap(container, finalWidth, finalHeight);
      }, 200);
      return;
    }

    // Dimensions are valid, initialize immediately
    this.initializeGoogleMap(container, width, height);
  }

  /**
   * Initialize Google Maps with verified dimensions
   * Use ResizeObserver to wait for actual dimensions before initializing
   */
  private async initializeGoogleMap(container: HTMLElement, width: number, height: number): Promise<void> {
    if (this.map) {
      console.warn('Map already exists!');
      return;
    }

    console.log('Initializing Google Maps with expected dimensions:', width, 'x', height);

    // Default center (Dubai)
    const defaultCenter: google.maps.LatLngLiteral = { lat: 25.2048, lng: 55.2708 };
    const defaultZoom = 11;

    // Use ResizeObserver to wait for container to actually have dimensions
    // This is the most reliable way to ensure dimensions before L.map()
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const actualWidth = entry.contentRect.width;
        const actualHeight = entry.contentRect.height;
        
        console.log('ResizeObserver detected dimensions:', actualWidth, 'x', actualHeight);
        console.log('Container offsetWidth/offsetHeight:', container.offsetWidth, 'x', container.offsetHeight);
        
        // If we have valid dimensions, initialize the map
        if (actualWidth > 0 && actualHeight > 0) {
          // Disconnect observer since we got dimensions
          resizeObserver.disconnect();
          
          // Double-check offsetWidth/offsetHeight (Leaflet reads these)
          const offsetWidth = container.offsetWidth || container.clientWidth || actualWidth;
          const offsetHeight = container.offsetHeight || container.clientHeight || actualHeight;
          
          console.log('✓ Got valid dimensions! Initializing Google Maps with:', offsetWidth, 'x', offsetHeight);
          
          // Initialize map NOW
          this.createGoogleMapInstance(container, offsetWidth, offsetHeight, defaultCenter, defaultZoom).catch(err => {
            console.error('Error creating Google Map instance:', err);
            this.error = 'Failed to load map. Please check your Google Maps API key.';
          });
          return;
        } else if (actualWidth === 0 && actualHeight === 0) {
          // Still 0, but observer is watching - it will fire again when dimensions change
          console.log('Container still has 0 dimensions, ResizeObserver will fire again when dimensions change...');
        }
      }
    });

    // Observe the container for size changes
    resizeObserver.observe(container);
    
    // Also check dimensions immediately in case they're already valid
    const immediateWidth = container.offsetWidth || container.clientWidth || 0;
    const immediateHeight = container.offsetHeight || container.clientHeight || 0;
    
    console.log('Immediate check - container dimensions:', immediateWidth, 'x', immediateHeight);

    if (immediateWidth > 0 && immediateHeight > 0) {
      // Already have dimensions! Disconnect observer and initialize immediately
      resizeObserver.disconnect();
      console.log('✓ Container already has valid dimensions! Initializing immediately...');
      this.createGoogleMapInstance(container, immediateWidth, immediateHeight, defaultCenter, defaultZoom).catch(err => {
        console.error('Error creating Google Map instance:', err);
        this.error = 'Failed to load map. Please check your Google Maps API key.';
      });
      return;
    }

    // If dimensions are 0, set explicit dimensions to trigger ResizeObserver
    console.warn('Container has 0 dimensions, setting explicit dimensions to trigger ResizeObserver...');
    
    const viewportHeight = window.innerHeight - 80;
    const viewportWidth = window.innerWidth;
    const header = document.querySelector('.page-header') as HTMLElement;
    const headerHeight = header ? header.offsetHeight : 100;
    
    const calculatedHeight = Math.max(600, viewportHeight - headerHeight - 48);
    const calculatedWidth = viewportWidth - 240;

    // Set explicit dimensions on wrapper and container
    const wrapper = container.closest('.map-view-wrapper') as HTMLElement;
    if (wrapper) {
      wrapper.style.height = (viewportHeight - headerHeight) + 'px';
      wrapper.style.minHeight = '600px';
    }
    
    container.style.height = calculatedHeight + 'px';
    container.style.width = calculatedWidth + 'px';
    container.style.minHeight = calculatedHeight + 'px';
    
    // Force reflow to ensure dimensions are applied
    container.offsetHeight;
    wrapper?.offsetHeight;
    container.getBoundingClientRect();
    
    // Wait a bit, then check again
    setTimeout(() => {
      const afterWaitWidth = container.offsetWidth || container.clientWidth || 0;
      const afterWaitHeight = container.offsetHeight || container.clientHeight || 0;
      
      console.log('After setting dimensions and waiting - container dimensions:', afterWaitWidth, 'x', afterWaitHeight);
      
      if (afterWaitWidth > 0 && afterWaitHeight > 0) {
        // Got dimensions! Disconnect observer and initialize
        resizeObserver.disconnect();
        console.log('✓ Container now has dimensions! Initializing Google Maps...');
        this.createGoogleMapInstance(container, afterWaitWidth, afterWaitHeight, defaultCenter, defaultZoom).catch(err => {
          console.error('Error creating Google Map instance:', err);
          this.error = 'Failed to load map. Please check your Google Maps API key.';
        });
      } else {
        // Still 0, but ResizeObserver is watching - it will fire when dimensions become available
        // Set a timeout to disconnect observer if it takes too long
        setTimeout(() => {
          resizeObserver.disconnect();
          // Proceed with calculated dimensions as last resort
          console.error('Timeout: Container still has 0 dimensions after 2 seconds!');
          console.error('Proceeding with calculated dimensions as last resort...');
          this.createGoogleMapInstance(container, calculatedWidth, calculatedHeight, defaultCenter, defaultZoom).catch(err => {
            console.error('Error creating Google Map instance:', err);
            this.error = 'Failed to load map. Please check your Google Maps API key.';
          });
        }, 2000);
      }
    }, 300);
  }

  /**
   * Wait for Google Maps API to load
   */
  private waitForGoogleMaps(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (typeof google !== 'undefined' && google.maps && google.maps.Map) {
        resolve();
        return;
      }

      // Check if window.googleMapsReady is set
      if ((window as any).googleMapsReady) {
        resolve();
        return;
      }

      // Wait for the API to load
      const checkInterval = setInterval(() => {
        if (typeof google !== 'undefined' && google.maps && google.maps.Map) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      // Also listen for the custom event
      const handleLoad = () => {
        clearInterval(checkInterval);
        window.removeEventListener('googlemapsloaded', handleLoad);
        resolve();
      };
      window.addEventListener('googlemapsloaded', handleLoad);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        window.removeEventListener('googlemapsloaded', handleLoad);
        reject(new Error('Google Maps API failed to load within 10 seconds'));
      }, 10000);
    });
  }

  /**
   * Actually create the Google Maps instance
   */
  private async createGoogleMapInstance(
    container: HTMLElement,
    width: number,
    height: number,
    center: google.maps.LatLngLiteral,
    zoom: number
  ): Promise<void> {
    try {
      // Wait for Google Maps API to be available
      await this.waitForGoogleMaps();

      // Verify Google Maps is available
      if (typeof google === 'undefined' || !google.maps || !google.maps.Map) {
        throw new Error('Google Maps API is not available');
      }

      // Get map type from theme
      const theme = MAP_THEMES[this.mapTheme] || MAP_THEMES[DEFAULT_MAP_THEME];
      // Convert string to Google Maps MapTypeId
      const mapTypeIdStr = theme.mapTypeId || 'satellite';
      const mapTypeId = mapTypeIdStr === 'satellite' 
        ? google.maps.MapTypeId.SATELLITE 
        : google.maps.MapTypeId.ROADMAP;

      // Create the Google Maps instance
      this.map = new google.maps.Map(container, {
        center: center,
        zoom: zoom,
        mapTypeId: mapTypeId,
        zoomControl: true,
        scrollwheel: true,
        disableDoubleClickZoom: false,
        draggable: true,
        gestureHandling: 'auto',
        fullscreenControl: false,
        streetViewControl: false,
        mapTypeControl: false
      });

      console.log('Google Maps created. Container dimensions:', container.offsetWidth, 'x', container.offsetHeight);

      // Add markers after a short delay
      setTimeout(() => {
        this.updateMap();
        // Trigger resize after markers are added
        if (this.map) {
          google.maps.event.trigger(this.map, 'resize');
        }
      }, 300);

      // Handle map ready event (idle event in Google Maps)
      google.maps.event.addListenerOnce(this.map, 'idle', () => {
        console.log('Map ready');
        if (this.map) {
          // Set explicit dimensions on container if needed
          container.style.height = height + 'px';
          container.style.width = width + 'px';
          
          // Force reflow
          container.offsetHeight;
          
          // Trigger resize
          setTimeout(() => {
            if (this.map) {
              google.maps.event.trigger(this.map, 'resize');
            }
          }, 100);
        }
      });
    } catch (error) {
      console.error('Error creating Google Maps instance:', error);
      this.map = null;
    }
  }

  // Google Maps doesn't need separate tile layer - map type is set during initialization

  /**
   * Update map with markers
   */
  private updateMap(): void {
    if (!this.map) {
      console.warn('Map not initialized, cannot update markers');
      return;
    }

    // Clear existing markers with proper cleanup (performance optimization)
    this.markers.forEach(marker => {
      marker.setMap(null);
      // Clean up overlay if it exists
      const overlay = (marker as any).overlay;
      if (overlay) {
        overlay.setMap(null);
      }
      const overlayElement = (marker as any).overlayElement;
      if (overlayElement && overlayElement.parentNode) {
        overlayElement.parentNode.removeChild(overlayElement);
      }
    });
    this.markers = [];
    
    this.cameraMarkers.forEach(marker => {
      marker.setMap(null);
      // Clean up overlay if it exists
      const overlay = (marker as any).overlay;
      if (overlay) {
        overlay.setMap(null);
      }
      const overlayElement = (marker as any).overlayElement;
      if (overlayElement && overlayElement.parentNode) {
        overlayElement.parentNode.removeChild(overlayElement);
      }
    });
    this.cameraMarkers = [];

    const parseCoordinate = (coord: number | string | undefined): number | null => {
      if (coord === undefined || coord === null) return null;
      const parsed = typeof coord === 'string' ? parseFloat(coord) : coord;
      if (isNaN(parsed) || parsed === 0) return null;
      return parsed;
    };

    const isValidCoordinate = (lat: number | string | undefined, lng: number | string | undefined): boolean => {
      const parsedLat = parseCoordinate(lat);
      const parsedLng = parseCoordinate(lng);
      return parsedLat !== null && parsedLng !== null;
    };

    // Add project markers with project cards (improved design)
    const bounds = new google.maps.LatLngBounds();
    const projectsWithCoords = this.projects.filter(p => isValidCoordinate(p.lat, p.lng));

    projectsWithCoords.forEach(project => {
      const lat = parseCoordinate(project.lat!)!;
      const lng = parseCoordinate(project.lng!)!;
      const position: google.maps.LatLngLiteral = { lat, lng };
      bounds.extend(position);

      // Create project card marker (replacing simple dots with cards)
      const projectImage = project.image || 'assets/images/lsl.svg';
      const projectName = project.name || 'Project';
      
      // Create custom HTML marker element with triangle
      const markerElement = document.createElement('div');
      markerElement.className = 'project-card-marker project-marker';
      markerElement.setAttribute('data-project-id', project.id);
      markerElement.innerHTML = `
        <div class="project-marker-wrapper">
          <div class="project-marker-card" style="width: 120px; max-width: 120px; overflow: hidden; box-sizing: border-box;">
            <div class="project-marker-image-frame" style="width: 100%; height: 60px; max-width: 100%; max-height: 60px; overflow: hidden; box-sizing: border-box; background: #ffffff;">
              <img src="${projectImage}" alt="${projectName}" class="project-marker-image" style="width: 100%; height: 100%; max-width: 100%; max-height: 100%; object-fit: cover; display: block;" />
            </div>
            <div class="project-marker-name-wrapper">
              <div class="project-marker-name">${projectName}</div>
            </div>
          </div>
          <div class="project-marker-triangle"></div>
        </div>
      `;

      // Create invisible marker for positioning
      const marker = new google.maps.Marker({
        position: position,
        map: this.map!,
        title: projectName,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg width="1" height="1" xmlns="http://www.w3.org/2000/svg"></svg>'),
          scaledSize: new google.maps.Size(1, 1),
          anchor: new google.maps.Point(0, 0)
        },
        optimized: true, // Performance optimization
        zIndex: 100
      });

      // Use OverlayView for custom HTML positioning
      class ProjectMarkerOverlay extends google.maps.OverlayView {
        private div: HTMLElement;
        private position: google.maps.LatLng;
        private projectId: string;

        constructor(position: google.maps.LatLng, content: HTMLElement, projectId: string) {
          super();
          this.position = position;
          this.div = content;
          this.projectId = projectId;
        }

        override onAdd() {
          const panes = this.getPanes()!;
          panes.overlayMouseTarget.appendChild(this.div);
          
          // Add hover effects
          this.div.addEventListener('mouseenter', () => {
            this.div.classList.add('marker-hover');
          });
          this.div.addEventListener('mouseleave', () => {
            this.div.classList.remove('marker-hover');
          });
        }

            override draw() {
              const overlayProjection = this.getProjection();
              const pixelPosition = overlayProjection.fromLatLngToDivPixel(this.position)!;
              // Position so triangle tip points to coordinate
              // Card is 120px wide, triangle is ~12px, so center at 60px
              // Total height: card (85px) + triangle (12px) = 97px
              // Triangle tip is at bottom, so position top at (y - 97)
              this.div.style.left = (pixelPosition.x - 60) + 'px';
              this.div.style.top = (pixelPosition.y - 97) + 'px';
              this.div.style.position = 'absolute';
              this.div.style.zIndex = '1000';
            }

        override onRemove() {
          if (this.div.parentNode) {
            this.div.parentNode.removeChild(this.div);
          }
        }
      }

      const overlay = new ProjectMarkerOverlay(new google.maps.LatLng(lat, lng), markerElement, project.id);
      overlay.setMap(this.map!);

      // Add click listener with visual feedback
      markerElement.addEventListener('click', (e) => {
        e.stopPropagation();
        // Add click feedback
        markerElement.classList.add('marker-clicked');
        setTimeout(() => {
          markerElement.classList.remove('marker-clicked');
          this.navigateToProject(project.id);
        }, 150);
      });

      // Store references for cleanup
      (marker as any).overlay = overlay;
      (marker as any).overlayElement = markerElement;
      (marker as any).projectId = project.id;

      this.markers.push(marker);
    });

    // Add camera markers with project cards
    this.projects.forEach(project => {
      const cameras = this.projectCameras.get(project.id) || [];
      
      cameras.forEach(camera => {
        const cameraLat = parseCoordinate(camera.lat);
        const cameraLng = parseCoordinate(camera.lng);
        
        if (cameraLat !== null && cameraLng !== null) {
          const cameraPosition: google.maps.LatLngLiteral = { lat: cameraLat, lng: cameraLng };
          bounds.extend(cameraPosition);

          // Create project card marker with image and name
          const projectImage = project.image || 'assets/images/lsl.svg';
          const projectName = project.name || 'Project';
          
          // Create custom HTML marker with triangle
          const markerElement = document.createElement('div');
          markerElement.className = 'project-card-marker';
          markerElement.innerHTML = `
            <div class="project-marker-wrapper">
              <div class="project-marker-card" style="width: 120px; max-width: 120px; overflow: hidden; box-sizing: border-box;">
                <div class="project-marker-image-frame" style="width: 100%; height: 60px; max-width: 100%; max-height: 60px; overflow: hidden; box-sizing: border-box; background: #ffffff;">
                  <img src="${projectImage}" alt="${projectName}" class="project-marker-image" style="width: 100%; height: 100%; max-width: 100%; max-height: 100%; object-fit: cover; display: block;" />
                </div>
                <div class="project-marker-name-wrapper">
                  <div class="project-marker-name">${projectName}</div>
                </div>
              </div>
              <div class="project-marker-triangle"></div>
            </div>
          `;
          
          const cameraMarker = new google.maps.Marker({
            position: cameraPosition,
            map: this.map!,
            title: projectName,
            icon: {
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg width="1" height="1" xmlns="http://www.w3.org/2000/svg"></svg>'),
              scaledSize: new google.maps.Size(1, 1),
              anchor: new google.maps.Point(0, 0)
            },
            optimized: true, // Performance optimization
            zIndex: 100
          });

          // Use OverlayView to position custom HTML with improved positioning
          class CameraMarkerOverlay extends google.maps.OverlayView {
            private div: HTMLElement;
            private position: google.maps.LatLng;
            private projectId: string;

            constructor(position: google.maps.LatLng, content: HTMLElement, projectId: string) {
              super();
              this.position = position;
              this.div = content;
              this.projectId = projectId;
            }

            override onAdd() {
              const panes = this.getPanes()!;
              panes.overlayMouseTarget.appendChild(this.div);
              
              // Add hover effects
              this.div.addEventListener('mouseenter', () => {
                this.div.classList.add('marker-hover');
              });
              this.div.addEventListener('mouseleave', () => {
                this.div.classList.remove('marker-hover');
              });
            }

            override draw() {
              const overlayProjection = this.getProjection();
              const pixelPosition = overlayProjection.fromLatLngToDivPixel(this.position)!;
              // Position so triangle tip points to coordinate
              // Card is 120px wide, triangle is ~12px, so center at 60px
              // Total height: card (85px) + triangle (12px) = 97px
              // Triangle tip is at bottom, so position top at (y - 97)
              this.div.style.left = (pixelPosition.x - 60) + 'px';
              this.div.style.top = (pixelPosition.y - 97) + 'px';
              this.div.style.position = 'absolute';
              this.div.style.zIndex = '1000';
            }

            override onRemove() {
              if (this.div.parentNode) {
                this.div.parentNode.removeChild(this.div);
              }
            }
          }

          const overlay = new CameraMarkerOverlay(new google.maps.LatLng(cameraLat, cameraLng), markerElement, project.id);
          overlay.setMap(this.map!);

          // Add click listener with visual feedback
          markerElement.addEventListener('click', (e) => {
            e.stopPropagation();
            // Add click feedback
            markerElement.classList.add('marker-clicked');
            setTimeout(() => {
              markerElement.classList.remove('marker-clicked');
              this.navigateToProject(project.id);
            }, 150);
          });

          // Store references for cleanup
          (cameraMarker as any).overlay = overlay;
          (cameraMarker as any).overlayElement = markerElement;
          (cameraMarker as any).projectId = project.id;

          this.cameraMarkers.push(cameraMarker);
        }
      });
    });

    // Fit map to bounds
    if (!bounds.isEmpty()) {
      this.map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
    } else {
      this.map.setCenter({ lat: 25.2048, lng: 55.2708 });
      this.map.setZoom(13);
    }
    
    console.log(`Map updated: ${this.markers.length} project markers, ${this.cameraMarkers.length} camera markers`);
    
    // Ensure map size is correct
    if (this.map) {
      google.maps.event.trigger(this.map, 'resize');
    }
  }



  private cleanupMap() {
    if (this.map) {
      // Remove markers
      this.markers.forEach(marker => {
        marker.setMap(null);
      });
      this.markers = [];
      
      // Remove camera markers and their overlays
      this.cameraMarkers.forEach(marker => {
        marker.setMap(null);
        // Clean up overlay if it exists
        const overlay = (marker as any).overlay;
        if (overlay) {
          overlay.setMap(null);
        }
        const overlayElement = (marker as any).overlayElement;
        if (overlayElement && overlayElement.parentNode) {
          overlayElement.parentNode.removeChild(overlayElement);
        }
      });
      this.cameraMarkers = [];
      
      // Google Maps doesn't have a remove method, just set to null
      this.map = null;
    }
  }
}
