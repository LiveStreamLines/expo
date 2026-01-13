import { Component, ElementRef, Input, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIcon } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environment/environments';

@Component({
  selector: 'app-studio',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIcon],
  templateUrl: './studio.component.html',
  styleUrl: './studio.component.css'
})
export class StudioComponent {

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() imageSrc!: string; // Parent-provided image source

  @ViewChild('watermarkInput', { static: false }) watermarkInput!: ElementRef<HTMLInputElement>;
  watermarkImage: HTMLImageElement | null = null;
  watermarkPosition = { x: 0, y: 0 }; // Default watermark position


  private context!: CanvasRenderingContext2D;
  image = new Image(); // To load the provided image
  private rect!: DOMRect; // Canvas rect for scaling
  private scaleX!: number; // Horizontal scale
  private scaleY!: number; // Vertical scale

  fontSize: number = 60;
  fontColor: string = '#000000';
  textValue: string = ''; // Current text being added
  textPosition: { x: number; y: number } | null = null; // Position of the text

  texts: { x: number; y: number; text: string; fontSize: number; color: string; selected: boolean }[] = [];
  selectedTextIndex: number | null = null; // Index of the selected text
  fontControllerPosition: { x: number; y: number } | null = null;

  shapes: {
    type: 'rectangle' | 'circle' | 'arrow';
    x: number;
    y: number;
    endX: number;
    endY: number;
    width: number;
    height: number;
    fillColor: string;
    borderColor: string;
    borderWidth: number;
    color: string;
    lineWidth?: number;
    moveMode?: boolean;
    selected?: boolean;
  }[] = [];
  selectedShapeIndex: number | null = null; // Index of the selected shape
  shapeControllerPosition: { x: number; y: number } | null = null;
  currentShape!: any; // Placeholder for the currently selected shape

  watermarks: any[] = []; // Store multiple watermarks
  currentWatermark: any = null; // Selected watermark
  watermarkControllerPosition: { x: number; y: number } | null = null; // Position for control

  brightness: number = 1; // Default brightness
  contrast: number = 1; // Default contrast
  saturation: number = 1; // Default saturation

  private isDragging: boolean = false;
  private hasDragged: boolean = false;
  private isResizing: boolean = false;
  isMoving: boolean = false;

  currentTool: string = ''; // Stores the current tool (text, rectangle, etc.)


  loadingCanvas: boolean = false; // Loading state


  constructor(private authService: AuthService) {}

  ngOnInit() {
    const canvas = this.canvasRef.nativeElement;
    this.context = canvas.getContext('2d')!;
    canvas.width = 800; // Default canvas size
    canvas.height = 600;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['imageSrc'] && this.imageSrc) {
      this.loadImage();
    }
  }

  selectTool(tool: string): void {
    this.currentTool = tool;
    console.log(`Selected Tool: ${tool}`);
  }

  private loadImage(): void {
    this.image.crossOrigin = 'anonymous'; // Set crossOrigin attribute
    this.image.src = this.imageSrc;
    this.image.onload = () => {
      const canvas = this.canvasRef.nativeElement;
      const context = this.context;

      // Resize canvas to match the image
      canvas.width = this.image.width;
      canvas.height = this.image.height;

      // Update rect and scale factors
      this.rect = canvas.getBoundingClientRect();
      this.scaleX = canvas.width / this.rect.width;
      this.scaleY = canvas.height / this.rect.height;

      // Draw the image on the canvas
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(this.image, 0, 0);
    };
  }

  // Method to trigger file upload for watermark
  addWatermark(): void {
    this.watermarkControllerPosition = null;
    this.currentTool = 'watermark';
    console.log(`Selected Tool: watermark`);

    const newWatermark = {
      image: null, // Placeholder for the uploaded image
      x: 100, // Default position
      y: 100,
      width: 200, // Default size
      height: 100,
      opacity: 0.5, // Default transparency
      moveMode: false, // Default move state
      selected: true,
    };
    
    this.watermarks.push(newWatermark);
    this.currentWatermark = newWatermark;
    this.watermarkInput.nativeElement.click();
  }

  updateWatermark() {
    // Redraw or update the watermark properties on the canvas
    if (this.currentWatermark) {
        this.updateCanvas();
    }
  }

  toggleWatermarkMove() {
    if (this.currentWatermark) {
        this.currentWatermark.moveMode = !this.currentWatermark.moveMode;
    }
  }

  deleteWatermark() {
    if (this.currentWatermark) {
        this.watermarks = this.watermarks.filter(w => w !== this.currentWatermark);
        this.currentWatermark = null;
        this.updateCanvas();
    }
  }

  // Handle watermark image upload
  handleWatermarkUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input && input.files && input.files.length > 0) {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = (e: any) => {
            if (this.currentWatermark) {
              const currentWatermark = this.currentWatermark;
              const img = new Image(); // Create an HTMLImageElement
              img.src = e.target.result; // Set the base64 string as the source
              img.onload = () => {
                currentWatermark.image = img; // Assign the loaded image to the watermark

                  // Update the controller position to match the watermark
                    this.watermarkControllerPosition = {
                      x: (currentWatermark.x + currentWatermark.width) / this.scaleX,
                      y: (currentWatermark.y + currentWatermark.height) / this.scaleY,
                  };

                  this.updateCanvas(); // Redraw the canvas after loading
              };
            }
        };
        reader.readAsDataURL(file);
    }
  }

  // Apply effects and redraw the canvas
  applyEffects(): void {
    this.updateCanvas();
  }

  private updateCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const context = this.context;
  
    // Clear the canvas and draw the background image
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(this.image, 0, 0);

    // Apply effects using filter
    context.filter = `brightness(${this.brightness}) contrast(${this.contrast}) saturate(${this.saturation})`;

    //  // Draw watermark
    //   if (this.watermarkImage) {
    //     context.globalAlpha = 0.5; // Semi-transparent
    //     context.drawImage(this.watermarkImage, this.watermarkPosition.x, this.watermarkPosition.y);
    //     context.globalAlpha = 1; // Reset transparency
    //   }

    // Redraw all watermarks
    this.watermarks.forEach(watermark => {
        if (watermark.image) {
            context.globalAlpha = watermark.opacity;
            context.drawImage(
                watermark.image,
                watermark.x,
                watermark.y,
                watermark.width,
                watermark.height
            );
        }

         // Highlight selected watermark
        if (watermark.selected) {
          context.globalAlpha = 1; // Ensure full opacity for the border
          context.strokeStyle = 'blue'; // Highlight color
          context.lineWidth = 2;
          context.strokeRect(
              watermark.x - 2,
              watermark.y - 2,
              watermark.width + 4,
              watermark.height + 4
          );
        }
    });
  
    // Draw texts
    this.texts.forEach((t, index) => {
      context.font = `${t.fontSize}px Arial`;
      context.fillStyle = t.color;
      context.fillText(t.text, t.x, t.y);
  
      if (index === this.selectedTextIndex) {
        // Draw a bounding box around the selected text
        const textWidth = context.measureText(t.text).width;
        const textHeight = t.fontSize; // Approximate text height
        context.strokeStyle = 'blue';
        context.lineWidth = 2;
        context.strokeRect(t.x - 5, t.y - textHeight, textWidth + 10, textHeight + 10);
      }
    });

    // Reset globalAlpha for other elements
    context.globalAlpha = 1;
  
    // Draw shapes
    this.shapes.forEach((shape, index) => {
      context.beginPath();

      if (shape.type === 'rectangle') {
        // Draw rectangle
        context.fillStyle = shape.fillColor;
        context.fillRect(shape.x, shape.y, shape.width, shape.height);

        // Draw rectangle border
        if (shape.borderColor && shape.borderWidth > 0) {
          context.strokeStyle = shape.borderColor;
          context.lineWidth = shape.borderWidth;
          context.strokeRect(shape.x, shape.y, shape.width, shape.height);
        }
  
        // Draw boundary if selected
        if (index === this.selectedShapeIndex) {
          context.strokeStyle = 'blue';
          context.lineWidth = 2;
          context.strokeRect(shape.x, shape.y, shape.width, shape.height);
        }

      } else if (shape.type === 'circle') {
        // Draw circle
        const radiusX = Math.abs(shape.width) / 2; // Horizontal radius
        const radiusY = Math.abs(shape.height) / 2; // Vertical radius
        const centerX = shape.x + radiusX; // Circle's center X
        const centerY = shape.y + radiusY; // Circle's center Y
  
        context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        context.fillStyle = shape.fillColor;
        context.fill();

        // Draw circle border
        if (shape.borderColor && shape.borderWidth > 0) {
          context.strokeStyle = shape.borderColor;
          context.lineWidth = shape.borderWidth;
          context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
          context.stroke();
        }
  
        // Draw boundary if selected
        if (index === this.selectedShapeIndex) {
          context.strokeStyle = 'blue';
          context.lineWidth = 2;
          context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
          context.stroke();
        }
      } else if (shape.type === 'arrow') {
         // Draw arrow line
        context.strokeStyle = shape.color;
        context.lineWidth = shape.lineWidth || 2;
        context.moveTo(shape.x!, shape.y!);
        context.lineTo(shape.endX!, shape.endY!);
        context.stroke();

        // Draw arrowhead
        const arrowAngle = Math.atan2(shape.endY! - shape.y!, shape.endX! - shape.x!);
        const arrowHeadLength = 50; // Length of the arrowhead

        // Left wing of the arrowhead
        context.moveTo(shape.endX!, shape.endY!);
        context.lineTo(
          shape.endX! - arrowHeadLength * Math.cos(arrowAngle - Math.PI / 6),
          shape.endY! - arrowHeadLength * Math.sin(arrowAngle - Math.PI / 6)
        );

        // Right wing of the arrowhead
        context.moveTo(shape.endX!, shape.endY!);
        context.lineTo(
          shape.endX! - arrowHeadLength * Math.cos(arrowAngle + Math.PI / 6),
          shape.endY! - arrowHeadLength * Math.sin(arrowAngle + Math.PI / 6)
        );

        context.stroke();

        // Draw boundary if selected
        if (index === this.selectedShapeIndex) {
          context.strokeStyle = 'blue';
          context.lineWidth = 2;
          context.strokeRect(
            Math.min(shape.x!, shape.endX!),
            Math.min(shape.y!, shape.endY!),
            Math.abs(shape.endX! - shape.x!),
            Math.abs(shape.endY! - shape.y!)
          );
        }
      }
      context.closePath();
    });
  }
  
  onCanvasClick(event: MouseEvent): void {
    if (this.hasDragged) {
      this.hasDragged = false; // Reset the flag
      return; // Skip adding text
    }
    const { x, y } = this.getCanvasCoordinates(event);

    // Deselect all watermarks initially
    this.watermarks.forEach(watermark => (watermark.selected = false));
    this.shapes.forEach(shape => (shape.selected = false));
    this.texts.forEach(text => (text.selected = false));


    if (this.currentTool ==='watermark') {
      const clickedwatermarkIndex = this.watermarks.findIndex((watermark) =>
        this.isPointInsideImage(watermark, x, y)
      );

      if (clickedwatermarkIndex !== -1) {
        this.currentWatermark = this.watermarks[clickedwatermarkIndex];
        this.currentWatermark.selected = true;
        // Update the controller position to match the watermark
        this.watermarkControllerPosition = {
            x: (this.currentWatermark.x + this.currentWatermark.width) / this.scaleX,
            y: (this.currentWatermark.y + this.currentWatermark.height) / this.scaleY,
        };
      } else {
        this.currentWatermark = null;
        this.watermarkControllerPosition = null;
      }
      this.updateCanvas();

    }


    // Check if there's a selected text
    if (this.selectedTextIndex !== null) {
      const selectedText = this.texts[this.selectedTextIndex];
      if (!this.isPointInsideText(selectedText, x, y)) {
        // Deselect the text if clicked outside
        this.selectedTextIndex = null;
        this.fontControllerPosition = null;
        this.updateCanvas();
        return; // Stop further processing
      }
    }

    // Handle shapes
      if (this.currentTool === 'rectangle' || this.currentTool === 'circle' || this.currentTool === 'arrow') {
        const clickedShapeIndex = this.shapes.findIndex((shape) =>
          this.isPointInsideShape(shape, x, y)
        );

        if (clickedShapeIndex !== -1) {
          this.selectShape(clickedShapeIndex); // Select the clicked shape
        } else {
          this.deselectShape(); // Deselect previously selected shape
        }

        this.updateCanvas();
        return; // Stop further processing for shapes
      }

  
    if (this.currentTool === 'text') {
      //Check if a text is clicked
      const clickedTextIndex = this.texts.findIndex((t) => this.isPointInsideText(t, x, y));
      if (clickedTextIndex !== -1) {
        this.selectText(clickedTextIndex); // Select existing text
      } else {
        // Add a new text
        this.texts.push({ x, y, text: 'New Text', fontSize: 40, color: '#000000', selected: true });
        this.selectedTextIndex = this.texts.length - 1;
        this.selectText(this.selectedTextIndex); // Select existing text
      }
      
      this.updateCanvas();
    }


  }

 
  private isPointInsideText(text: { x: number; y: number; text: string; fontSize: number }, x: number, y: number): boolean {
    const context = this.context;
  
    // Calculate the width and height of the text
    context.font = `${text.fontSize}px Arial`; // Match the font size
    const textWidth = context.measureText(text.text).width;
    const textHeight = text.fontSize; // Approximate height based on font size
  
    // Define the bounding box of the text
    const left = text.x;
    const right = text.x + textWidth;
    const top = text.y - textHeight; // Text's top edge (y is baseline)
    const bottom = text.y;
  
    // Check if the point is inside the bounding box
    return x >= left && x <= right && y >= top && y <= bottom;
  }
  
  isPointInsideImage(image: any, px: number, py: number): boolean {
    return (
        px >= image.x &&
        px <= image.x + image.width &&
        py >= image.y &&
        py <= image.y + image.height
    );
  }

  private selectText(index: number): void {
    this.selectedTextIndex = index;
    this.texts.forEach((t, i) => (t.selected = i === index)); // Mark selected text
    const selectedText = this.texts[index];
    this.fontSize = selectedText.fontSize;
    this.fontColor = selectedText.color;
    this.textValue = selectedText.text;

    // Get canvas bounding rect and scale
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

     // Calculate accurate font controller position
   const textHeight = selectedText.fontSize; // Approximate height using font size

   // Calculate the controller position relative to the canvas
    const controllerX = (selectedText.x / scaleX); // Center horizontally
    const controllerY = (selectedText.y / scaleY); // Slightly below the text

    
   this.fontControllerPosition = {
      x: controllerX, // Align with text's x position
      y: controllerY + textHeight + 10 // Offset slightly below the text
    };

  }
    
   updateText(): void {
    if (this.selectedTextIndex !== null) {
      const selectedText = this.texts[this.selectedTextIndex];
      selectedText.fontSize = this.fontSize; // Update font size
      selectedText.color = this.fontColor;  // Update font color
      selectedText.text = this.textValue;
      this.updateCanvas();
    }
   }

   removeText(): void {
    if (this.selectedTextIndex !== null) {
      // Remove the selected text from the array
      this.texts.splice(this.selectedTextIndex, 1);
  
      // Reset selection and controller position
      this.selectedTextIndex = null;
      this.fontControllerPosition = null;
  
      // Redraw the canvas
      this.updateCanvas();
    }
   }

  private isPointInsideShape(
      shape: { type: string; x: number; y: number; width: number; height: number, endX: number, endY: number },
      x1: number,
      y1: number
    ): boolean {
      if (shape.type === 'rectangle') {
        return (
          x1 >= shape.x &&
          x1 <= shape.x + shape.width &&
          y1 >= shape.y &&
          y1 <= shape.y + shape.height
        );
      } else if (shape.type === 'circle') {
        const radius = Math.sqrt(
          Math.pow(shape.width, 2) + Math.pow(shape.height, 2)
        );
        const dx = x1 - shape.x;
        const dy = y1 - shape.y;
        return Math.sqrt(dx * dx + dy * dy) <= radius;
      } else if (shape.type === 'arrow') {
        return this.isPointNearArrow(shape, x1, y1);
      }
      return false;
  }

  private selectShape(index: number): void {
    this.selectedShapeIndex = index;
    this.shapes.forEach((shape, i) => (shape.selected = i === index));

    const selectedShape = this.shapes[index];
    this.currentShape = selectedShape;
    this.updateShapeControllerPosition(selectedShape);
  }

  private deselectShape(): void {
    this.selectedShapeIndex = null;
    this.shapeControllerPosition = null;
    this.updateCanvas();
  }

  // Update shape properties
  updateShape(): void {
    if (this.selectedShapeIndex !== null) {
      this.updateCanvas();
    }
  }

  // Delete the selected shape
  deleteShape(): void {
    if (this.selectedShapeIndex !== null) {
      this.shapes.splice(this.selectedShapeIndex, 1);
      this.deselectShape();
    }
  }  

    
  onCanvasMouseDown(event: MouseEvent): void {
    const { x, y } = this.getCanvasCoordinates(event);
  
    // Check if a text is selected and begin dragging if inside the text
    if (this.selectedTextIndex !== null) {
      const selectedText = this.texts[this.selectedTextIndex];
      if (this.isPointInsideText(selectedText, x, y)) {
        this.isDragging = true;
        return; // Stop further processing if dragging a text
      }
    }
    
    if (this.selectedShapeIndex !== null) {
      const selectedShape = this.shapes[this.selectedShapeIndex];
      if (this.isPointInsideShape(selectedShape, x, y)) {
        this.isDragging = true;  
      }
    } else if (this.currentTool === 'rectangle' || this.currentTool === 'circle') {    // Create a new shape if none is selected
      // Create a new shape if none is selected
        this.isDragging = true;
        this.shapes.push({
          type: this.currentTool,
          x,
          y,
          width: 0,
          height: 0,
          color: '',
          endX: 0,
          endY: 0,
          fillColor: 'rgba(0,0,0,0)', // Default fill color
          borderColor: '#000000', // Default border color
          borderWidth: 10, // Default border width
          selected: false,
          moveMode: false,
        });
        this.selectedShapeIndex = this.shapes.length - 1; // Select the new shape
    } else if (this.currentTool === 'arrow') {
      // Start drawing an arrow
        this.isDragging = true;
        this.shapes.push({
          type: 'arrow',
          x: x,
          y: y,
          width: 0,
          height: 0,
          endX: x,
          endY: y,
          color: '#000000', // Default color
          lineWidth: 10, // Default line width
          fillColor: '', // Default fill color
          borderColor: '', // Default border color
          borderWidth: 0, // Default border width
          selected: false,
        });
        this.selectedShapeIndex = this.shapes.length - 1; // Select the newly created arrow
    }

    if (this.currentWatermark && this.currentWatermark.selected) {
      this.isDragging = true;
    }
    
  } 
  
  
  onCanvasMouseMove(event: MouseEvent): void {
    if (!this.isDragging) return;
    const { x, y } = this.getCanvasCoordinates(event);
  
    // Handle moving text
    if (this.currentTool === 'text' && this.selectedTextIndex !== null) {
      this.hasDragged = true;

      const rect = this.canvasRef.nativeElement.getBoundingClientRect();
      const x = (event.clientX - rect.left) * this.scaleX;
      const y = (event.clientY - rect.top) * this.scaleY;
  
      const selectedText = this.texts[this.selectedTextIndex];
      selectedText.x = x;
      selectedText.y = y;
  
      // Update the font controller position
      this.fontControllerPosition = {
        x: event.clientX - rect.left + 10, // Offset slightly to the right
        y: event.clientY - rect.top + selectedText.fontSize / 2 + 10, // Offset slightly below
      };
    }
  
    // Handle drawing or resizing shapes
    else if (
      (this.currentTool === 'rectangle' || this.currentTool === 'circle') &&
      this.selectedShapeIndex !== null
    ) {

      const selectedShape = this.shapes[this.selectedShapeIndex];
      if (selectedShape.moveMode) {
        // Move the shape
        const dx = x - selectedShape.x;
        const dy = y - selectedShape.y;
        selectedShape.x += dx;
        selectedShape.y += dy;
      } else {
        selectedShape.width = x - selectedShape.x;
        selectedShape.height = y - selectedShape.y;
      }
     
      // Update shape controller position
      //this.updateShapeControllerPosition(selectedShape);

    } else if (this.currentTool === 'arrow' && this.selectedShapeIndex !== null) {
      const currentShape = this.shapes[this.selectedShapeIndex];
      if (currentShape.type === 'arrow') {
        if (currentShape.moveMode) {
          const dx = x - currentShape.x;
          const dy = y - currentShape.y;

          currentShape.x += dx;
          currentShape.y += dy;
          currentShape.endX += dx;
          currentShape.endY += dy;
        } else {
          currentShape.endX = x;
          currentShape.endY = y;
        }
      }
      //this.updateShapeControllerPosition(currentShape);

    } else if (this.currentTool === 'watermark' && this.currentWatermark) {
      const currentWatermark = this.currentWatermark;
      if (currentWatermark.moveMode) {
        const dx = x - currentWatermark.x;
        const dy = y - currentWatermark.y;
        currentWatermark.x += dx;
        currentWatermark.y += dy;
      } else {
        currentWatermark.width = x - currentWatermark.x;
        currentWatermark.height = y - currentWatermark.y;
      }
    }

    
  
    this.updateCanvas();
  }
  
  onCanvasMouseUp(): void {
    this.isDragging = false;

    // Handle shape creation
    if (this.currentTool === 'rectangle' || this.currentTool === 'circle') {
      if (this.selectedShapeIndex !== null) {
        const currentShape = this.shapes[this.selectedShapeIndex];
  
        // Remove the shape if it has invalid dimensions
        if (currentShape.width === 0 || currentShape.height === 0) {
          this.shapes.pop();
          this.selectedShapeIndex = null;
        } else {
          // Mark the shape as finalized
          currentShape.selected = true;

          // Update shape controller position
          this.shapeControllerPosition = {
            x: currentShape.x ,
            y: currentShape.y ,
          };
        }
      }
    }

    if (this.currentTool === 'arrow' && this.selectedShapeIndex !== null) {
      const currentShape = this.shapes[this.selectedShapeIndex];
      if (
        currentShape.type === 'arrow' &&
        currentShape.x === currentShape.endX &&
        currentShape.y === currentShape.endY
      ) {
        // Remove the arrow if it's just a dot
        this.shapes.pop();
        this.selectedShapeIndex = null;
      }
    }
      // Reset drag and selection states
      this.updateCanvas();
  }

  private updateShapeControllerPosition(shape: {
    type: 'rectangle' | 'circle' | 'arrow';
    x: number;
    y: number;
    endX: number;
    endY: number;
    width: number;
    height: number;
  }): void {

     // Get canvas bounding rect and scale
     const canvas = this.canvasRef.nativeElement;
     const rect = canvas.getBoundingClientRect();
     const scaleX = canvas.width / rect.width;
     const scaleY = canvas.height / rect.height;

    if (shape.type === 'rectangle') {
      // For rectangles, position near the bottom-right corner
      this.shapeControllerPosition = {
        x: ((shape.x + shape.width) / scaleX) + 20, // Offset 10px to the right
        y: ((shape.y + shape.height) / scaleY) + 20, // Offset 10px below
      };
    } else if (shape.type === 'circle') {
      const radius = Math.sqrt(shape.width ** 2 + shape.height ** 2) / 2;
      // For circles, position near the bounding box's bottom-right corner
      this.shapeControllerPosition = {
        x: ((shape.x + radius) / scaleX) + 50, // Offset 10px to the right of bounding box
        y: ((shape.y + radius) / scaleY) + 50, // Offset 10px below the bounding box
      };
    } else if (shape.type === 'arrow') {
      // For arrows, position near the midpoint of the line
      const midX = (shape.x + shape.endX) / 2; // Midpoint X
      const midY = (shape.y + shape.endY) / 2; // Midpoint Y
      
      this.shapeControllerPosition = {
        x: (midX / scaleX) + 50, // Offset 20px to the right of the midpoint
        y: (midY / scaleY) + 50, // Offset 20px below the midpoint
  };

    }
  }
  

  private getCanvasCoordinates(event: MouseEvent): { x: number; y: number } {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();

    const x = (event.clientX - rect.left) * this.scaleX;
    const y = (event.clientY - rect.top) * this.scaleY;

    return { x, y };
  }

  toggleShapeMove(): void {
    if (this.selectedShapeIndex !== null) {
      const selectedShape = this.shapes[this.selectedShapeIndex];
      selectedShape.moveMode = !selectedShape.moveMode; // Toggle move mode
    }
  }

  private isPointNearArrow(shape: { x: number; y: number; endX: number; endY: number; type: string }, x1: number, y1: number): boolean {
    if (shape.type !== 'arrow') return false;
  
    // Calculate the distance of the point (x, y) to the line segment (startX, startY) -> (endX, endY)
    const { x, y, endX, endY } = shape;
  
    const lineLength = Math.sqrt(Math.pow(endX - x, 2) + Math.pow(endY - y, 2));
    if (lineLength === 0) return false; // Degenerate line
  
    // Project the point (x, y) onto the line segment
    const t = ((x1 - x) * (endX - x) + (y1 - y) * (endY - y)) / Math.pow(lineLength, 2);
    const clampedT = Math.max(0, Math.min(1, t)); // Clamp t to the range [0, 1]
    const closestX = x + clampedT * (endX - x);
    const closestY = y + clampedT * (endY - y);
  
    // Calculate the distance from the point to the closest point on the line
    const distanceToLine = Math.sqrt(Math.pow(x1 - closestX, 2) + Math.pow(y1 - closestY, 2));
  
    // Define a threshold for selection (adjust this value for better user experience)
    const selectionThreshold = 5; // Pixels
  
    return distanceToLine <= selectionThreshold;
  }

  clearCanvas(): void {
    // Clear all shapes and texts
    this.shapes = [];
    this.texts = [];
    this.selectedShapeIndex = null;
    this.selectedTextIndex = null;
  
    // Clear the font and shape controllers
    this.fontControllerPosition = null;
    this.shapeControllerPosition = null;

     // Reset effects
      this.brightness = 1;
      this.contrast = 1;
      this.saturation = 1;

      // Clear watermark
      this.watermarkImage = null; // Clear the watermark

      // Clear the canvas
      const canvas = this.canvasRef.nativeElement;
      const context = this.context;
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Redraw the image if it exists
      if (this.image) {
        context.drawImage(this.image, 0, 0);
      }
  }

  uploadCanvas(): Promise<string> {
    return new Promise((resolve, reject) => {
        const canvas = this.canvasRef.nativeElement;

        canvas.toBlob((blob) => {
            if (!blob) {
                console.error('Failed to create Blob from canvas.');
                return reject('Failed to create Blob from canvas.');
            }

            this.loadingCanvas = true;

            const formData = new FormData();
            formData.append('image', blob, 'canvas_image.png');

            const authh = this.authService.getAuthToken();

            fetch(environment.backend + '/api/studio/save', {
                method: 'POST',
                headers: {
                    'Authorization': authh ? `Bearer ${authh}` : '',
                },
                body: formData,
            })
                .then((response) => response.json())
                .then((data) => {
                    if (data.url) {
                        resolve(data.url); // Return the URL of the uploaded image
                    } else {
                        reject('No URL returned from the server.');
                    }
                })
                .catch((error) => {
                    console.error('Error saving image:', error);
                    reject(error);
                })
                .finally(() => {
                    this.loadingCanvas = false;
                });
        }, 'image/png');
    }); 
  }

  downloadImage(imageUrl: string): void {
    fetch(environment.backend + "/" + imageUrl)
        .then((response) => response.blob())
        .then((imageBlob) => {
            const imageUrl = URL.createObjectURL(imageBlob);

            const link = document.createElement('a');
            link.href = imageUrl;
            link.download = 'canvas_image.png';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            URL.revokeObjectURL(imageUrl); // Clean up memory
        })
        .catch((error) => {
            console.error('Error downloading image:', error);
        });
  }

  processCanvas(): void {
    this.uploadCanvas()
        .then((imageUrl) => {
            // Call the download function with the returned URL
            this.downloadImage(imageUrl);
        })
        .catch((error) => {
            console.error('Error processing canvas:', error);
        });
  }



  
  
}
