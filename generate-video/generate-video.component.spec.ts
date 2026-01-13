import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GenerateVideoComponent } from './generate-video.component';

describe('GenerateVideoComponent', () => {
  let component: GenerateVideoComponent;
  let fixture: ComponentFixture<GenerateVideoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GenerateVideoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GenerateVideoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
