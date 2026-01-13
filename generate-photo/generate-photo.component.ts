import { Component, OnInit, Input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';  // Import FormsModule for ngModel
import { CommonModule } from '@angular/common'; // Import CommonModule for ngFor and ngIf
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { PhotoService } from '../../services/photo.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { AuthService } from '../../services/auth.service';
import { CameraDetailService } from '../../services/camera-detail.service';

@Component({
  selector: 'app-generate-photo',
  standalone: true,
  imports: [
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    FormsModule,
    CommonModule,
    MatCheckboxModule
  ],
  templateUrl: './generate-photo.component.html',
  styleUrl: './generate-photo.component.css'
})
export class GeneratePhotoComponent implements OnInit {
  @Input() cameraName!: string; // Receiving cameraName from pare

  projectTag!: string;
  developerTag!: string;

  startDate!: string;
  endDate!: string;

  firstdate!: string;
  lastdate!: string;

  hour1: number = 8;
  hour2: number = 9;

  showDate: boolean = false;
  showTime: boolean = false;

  isLoading: boolean = false;
  errorMessage: string | null = null;
  filteredPicsCount!: number;
  isFilterComplete: boolean = false;

  userId: string | null = null;
  userName: string | null = null;

  constructor(
    private photoService: PhotoService,
    private authService: AuthService,
    private cameraDetailService: CameraDetailService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.developerTag = this.route.snapshot.paramMap.get('developerTag')!;
    this.projectTag = this.route.snapshot.paramMap.get('projectTag')!;

    this.userId = this.authService.getUserId();
    this.userName = this.authService.getUsername();

    this.setDefaultDates();
  }

  private setDefaultDates(): void {
    const now = new Date(); // Current date
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1); // First day of last month
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of last month
    this.startDate = this.formatDate(firstDayLastMonth);
    this.endDate = this.formatDate(lastDayLastMonth);

    this.cameraDetailService.getCameraDetails(this.developerTag,this.projectTag,this.cameraName)
    .subscribe({
      next:(cameraDetail) => {
        this.firstdate = this.toDate(cameraDetail.firstPhoto);
        this.lastdate = this.toDate(cameraDetail.lastPhoto);
      },
      error:(err) => {
        console.log(err);
      }
    });

  }

  onStartDateChange(): void {
    if (!this.startDate) return; // Ensure startDate is defined
  
   // Parse startDate as a Date object
    const startDateObj = new Date(this.startDate);
  
    // Calculate endDate as one month after startDate
    const nextMonthDate = new Date(startDateObj);
    nextMonthDate.setMonth(startDateObj.getMonth() + 1);
  
    // Format nextMonthDate for comparison and input compatibility
    const formattedNextMonthDate = this.formatDate(nextMonthDate);
  
    // Set endDate to nextMonthDate or lastdate, whichever is earlier
    if (new Date(formattedNextMonthDate) > new Date(this.lastdate)) {
      this.endDate = this.lastdate;
    } else {
      this.endDate = formattedNextMonthDate;
    }
  }

  
  private toDate(date:string): string {
    const year = date.slice(0, 4);
    const month = date.slice(4, 6);
    const day = date.slice(6, 8);
    
    return `${year}-${month}-${day}`;
  }

  onHour1Change(newHour: number): void {
    this.hour1 = newHour;
    this.adjustEndHour();
  }

  adjustEndHour(): void {
    this.hour2 = this.hour1 + 1;
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  }

  
  formatDateForInput(dateString: string): string {
    return dateString.replace(/-/g, '');

  }

  filterImages() {
    const role = this.authService.getUserRole();
    console.log(this.authService.getCanGenerateVideoAndPics());
    const permission = this.authService.getCanGenerateVideoAndPics(); // Convert to boolean

    // Check if the user has the required role or permission
    const hasAccess = role === 'Super Admin' || role === 'Admin' || permission;

    if (hasAccess) {
      this.isLoading = true;
      this.errorMessage = null;

      const formData = new FormData();
      formData.append('developerId', this.developerTag);
      formData.append('projectId', this.projectTag);
      formData.append('cameraId', this.cameraName);
      formData.append('date1', this.formatDateForInput(this.startDate));
      formData.append('date2', this.formatDateForInput(this.endDate));
      formData.append('hour1', this.hour1.toString().padStart(2, '0'));
      formData.append('hour2', this.hour2.toString().padStart(2, '0'));
      
      formData.append('userId', this.userId!);
      formData.append('userName', this.userName!);

      this.photoService.generatePhoto(formData).subscribe({
        next: (response) => {
          this.isLoading = false;
          this.filteredPicsCount = response.filteredImageCount;
          this.isFilterComplete = true;
          this.snackBar.open('Photo request queued successfully!', 'Close', {
            duration: 3000,
          });
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = 'Failed to generate photo request. Please try again.';
          console.error(error);
          this.snackBar.open(this.errorMessage, 'Close', { duration: 3000 });
        },
      });
    } else {
      alert(
        `Role: ${role}, Permission: ${permission}. You don't have the permission to generate photo. Contact your admin.`
      );
    }
  }

  preventManualInput(event: KeyboardEvent): void {
    // Allow only arrow keys, tab, backspace, and delete
    const allowedKeys = ['ArrowUp', 'ArrowDown', 'Tab', 'Backspace', 'Delete'];
    if (!allowedKeys.includes(event.key)) {
      event.preventDefault();
    }
  }  
  
  increment(fieldName: string): void {
    const field = (this as any)[fieldName];
    if (field !== undefined) {
      if (fieldName === 'hour1' && field < 22) {
        (this as any)[fieldName] = field + 1;
        this.hour2 = Math.max(this.hour2, this.hour1 + 1); // Ensure hour2 is at least hour1 + 1
      } else if (fieldName === 'hour2' && field < 23) {
        (this as any)[fieldName] = field + 1;
      }
    }
  }
  
  decrement(fieldName: string): void {
    const field = (this as any)[fieldName];
    if (field !== undefined) {
      if (fieldName === 'hour1' && field > 0) {
        (this as any)[fieldName] = field - 1;
        if (this.hour2 <= this.hour1) {
          this.hour2 = this.hour1 + 1; // Adjust hour2 to maintain the constraint
        }
      } else if (fieldName === 'hour2' && field > this.hour1 + 1) {
        (this as any)[fieldName] = field - 1;
      }
    }
  }

  goGallery(): void {
    this.router.navigate([`gallery/photo-request`]);
  }

}
