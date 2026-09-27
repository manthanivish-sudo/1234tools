(function(){
/* PDF Editor Preview Extension - Adds visual preview with click-to-set coordinates */

// Add CSS styles immediately
const style = document.createElement('style');
style.textContent = `
  .pdf-preview-container {
    margin: 20px 0;
    padding: 20px;
    background: var(--bg-1, #0a0e1a);
    border: 1px solid var(--border, rgba(255, 255, 255, 0.09));
    border-radius: var(--radius, 18px);
    text-align: center;
    position: relative;
  }
  
  .preview-placeholder {
    color: var(--text-3, #8790a5);
    font-size: 0.95rem;
  }
  
  .preview-error {
    color: #e05c4a;
    font-size: 0.9rem;
  }
  
  .pdf-preview-canvas {
    max-width: 100%;
    height: auto;
    border: 2px solid var(--border, rgba(255, 255, 255, 0.09));
    border-radius: var(--radius-sm, 12px);
    cursor: crosshair;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }
  
  .text-preview {
    position: absolute;
    pointer-events: none;
    border: 2px dashed var(--accent, #f7c948);
    padding: 4px;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 4px;
    transition: all 0.2s ease;
    white-space: nowrap;
  }
`;
document.head.appendChild(style);

// Load pdf.js if not already loaded
function loadPdfJS() {
  if (window.pdfjsLib) return Promise.resolve();
  
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '../engine/vendor/pdfjs/pdf.min.mjs';
    script.type = 'module';
    script.textContent = `
      import * as pdfjsLib from '../engine/vendor/pdfjs/pdf.min.mjs';
      window.pdfjsLib = pdfjsLib;
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = '../engine/vendor/pdfjs/pdf.worker.min.mjs';
      window.dispatchEvent(new CustomEvent('pdfjsLoaded'));
    `;
    script.onerror = reject;
    document.head.appendChild(script);
    
    window.addEventListener('pdfjsLoaded', resolve, { once: true });
    
    // Fallback timeout
    setTimeout(() => {
      if (!window.pdfjsLib) {
        console.warn('pdf.js failed to load, using placeholder preview');
        resolve(); // Resolve anyway so we can use placeholder
      }
    }, 3000);
  });
}

// Wait for the page to load
document.addEventListener('DOMContentLoaded', function() {
  // Check if this is the PDF Editor page
  if (!document.querySelector('[data-tool="pdf-editor"]')) return;
  
  // Try to add preview periodically
  let attempts = 0;
  const maxAttempts = 20;
  
  const tryAddPreview = function() {
    attempts++;
    
    // Check if preview already exists
    if (document.querySelector('.pdf-preview-container')) return;
    
    // Check if file is loaded
    const fileRow = document.querySelector('.file-row');
    if (!fileRow) {
      if (attempts < maxAttempts) {
        setTimeout(tryAddPreview, 500);
      }
      return;
    }
    
    // Find the tool controls container
    const optBar = document.querySelector('.opt-bar');
    if (!optBar) {
      if (attempts < maxAttempts) {
        setTimeout(tryAddPreview, 500);
      }
      return;
    }
    
    // Create preview container
    const previewContainer = document.createElement('div');
    previewContainer.className = 'pdf-preview-container';
    previewContainer.innerHTML = '<p class="preview-placeholder">Loading PDF preview...</p>';
    
    // Insert preview after controls, before the run button
    const runBar = document.querySelector('.pdf-run');
    if (runBar) {
      runBar.parentNode.insertBefore(previewContainer, runBar);
    } else {
      optBar.parentNode.appendChild(previewContainer);
    }
    
    // Try to render preview
    loadPdfJS().then(() => {
      setTimeout(function() {
        renderPreview(previewContainer);
      }, 300);
    });
  };
  
  // Start trying
  setTimeout(tryAddPreview, 1000);
});

async function renderPreview(container) {
  try {
    // Try to access the actual PDF by intercepting the file data
    const fileRow = document.querySelector('.file-row');
    if (!fileRow) {
      container.innerHTML = '<p class="preview-placeholder">No PDF loaded yet</p>';
      return;
    }
    
    // Get the file name to understand what we're working with
    const fileName = fileRow.querySelector('.file-name')?.textContent || 'document';
    
    // Try to access the PDF library and render the actual PDF
    if (window.pdfjsLib) {
      try {
        // Try to get the PDF from the existing loaded data
        // We'll need to access the PDF document that was loaded by the main tool
        const pdfBytes = await getPDFBytes();
        if (pdfBytes) {
          renderActualPDF(container, pdfBytes, fileName);
          return;
        }
      } catch (e) {
        console.log('Could not render actual PDF, using placeholder:', e);
      }
    }
    
    // Fallback: create a placeholder with correct dimensions
    createPlaceholderPreview(container, fileName);
    
  } catch (error) {
    console.error('Error rendering preview:', error);
    container.innerHTML = '<p class="preview-error">Could not render PDF preview. Please use the coordinate inputs.</p>';
  }
}

async function getPDFBytes() {
  // Try to access the PDF from the existing tool's internal state
  // This is tricky because the PDF is stored in a closure
  
  // Method 1: Try to access from the global PDF tools state
  if (window.PDF_TOOLS && window.PDF_TOOLS['pdf-editor']) {
    // The tool spec exists, but we need the actual loaded PDF
  }
  
  // Method 2: Try to hook into the PDF core
  if (window.MVRPdfCore) {
    // We can try to get the PDF from the file input that was used
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput && fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      const arrayBuffer = await file.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    }
  }
  
  return null;
}

async function renderActualPDF(container, pdfBytes, fileName) {
  try {
    const canvas = document.createElement('canvas');
    canvas.className = 'pdf-preview-canvas';
    const ctx = canvas.getContext('2d');
    
    // Load and render the actual PDF using pdf.js
    const loadingTask = window.pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    
    const scale = 1.5; // Scale up for better visibility
    const viewport = page.getViewport({ scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };
    
    await page.render(renderContext).promise;
    
    // Add overlay text
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 350, 70);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('👆 Click to set text position', 20, 35);
    ctx.font = '14px Arial';
    ctx.fillText(`📄 ${fileName}`, 20, 60);
    
    // Clear and add canvas
    container.innerHTML = '';
    container.appendChild(canvas);
    
    // Add click handler with scale adjustment
    addCanvasInteractivity(container, canvas, scale);
  } catch (error) {
    console.error('Error rendering actual PDF:', error);
    createPlaceholderPreview(container, fileName);
  }
}

function createPlaceholderPreview(container, fileName) {
  const canvas = document.createElement('canvas');
  canvas.className = 'pdf-preview-canvas';
  const ctx = canvas.getContext('2d');
  
  // Standard A4 size in points (most common)
  const width = 595;
  const height = 842;
  
  canvas.width = width;
  canvas.height = height;
  
  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  
  // Page border
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, width, height);
  
  // Grid
  ctx.strokeStyle = '#f0f0f0';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  
  // Center marker
  ctx.strokeStyle = '#ff9d2e';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(width/2 - 20, height/2);
  ctx.lineTo(width/2 + 20, height/2);
  ctx.moveTo(width/2, height/2 - 20);
  ctx.lineTo(width/2, height/2 + 20);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Info text
  ctx.fillStyle = '#666666';
  ctx.font = '14px Arial';
  ctx.fillText(`📄 ${fileName}`, 20, 30);
  ctx.fillText('Standard A4: 595 × 842 points', 20, 50);
  ctx.fillStyle = '#ff9d2e';
  ctx.font = 'bold 14px Arial';
  ctx.fillText('👆 Click anywhere to set X/Y coordinates', 20, height - 20);
  ctx.fillStyle = '#999999';
  ctx.font = '12px Arial';
  ctx.fillText('Center point: X=297, Y=421', 20, height - 40);
  
  // Clear and add canvas
  container.innerHTML = '';
  container.appendChild(canvas);
  
  // Add click handler
  addCanvasInteractivity(container, canvas, 1);
}

function addCanvasInteractivity(container, canvas, scale = 1) {
  canvas.style.cursor = 'crosshair';
  canvas.addEventListener('click', function(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Adjust coordinates for scale factor
    const adjustedX = x / scale;
    const adjustedY = y / scale;
    
    // Find and update coordinate inputs
    const xInput = document.querySelector('input[name="x"]');
    const yInput = document.querySelector('input[name="y"]');
    
    if (xInput) xInput.value = Math.round(adjustedX);
    if (yInput) yInput.value = Math.round(adjustedY);
    
    // Show text preview at adjusted position
    showTextPreview(container, canvas, x, y);
  });
  
  // Show initial text preview at center
  showTextPreview(container, canvas, canvas.width / 2, canvas.height / 2);
  
  // Update preview when controls change
  const controls = document.querySelectorAll('.opt-bar input, .opt-bar textarea');
  controls.forEach(function(control) {
    control.addEventListener('input', function() {
      const existingPreview = container.querySelector('.text-preview');
      if (existingPreview) {
        const text = document.querySelector('textarea[name="text"]')?.value || 'Hello';
        const size = document.querySelector('input[name="size"]')?.value || 16;
        const color = document.querySelector('input[name="colour"]')?.value || '#000000';
        
        existingPreview.textContent = text;
        existingPreview.style.fontSize = size + 'px';
        existingPreview.style.color = color;
      }
    });
  });
}

function showTextPreview(container, canvas, x, y) {
  // Remove existing preview
  const existing = container.querySelector('.text-preview');
  if (existing) existing.remove();
  
  // Get current values
  const text = document.querySelector('textarea[name="text"]')?.value || 'Hello';
  const size = document.querySelector('input[name="size"]')?.value || 16;
  const color = document.querySelector('input[name="colour"]')?.value || '#000000';
  
  // Create preview
  const preview = document.createElement('div');
  preview.className = 'text-preview';
  preview.textContent = text;
  preview.style.cssText = `
    position: absolute;
    left: ${x}px;
    top: ${y}px;
    font-size: ${size}px;
    color: ${color};
    pointer-events: none;
    border: 2px dashed #f7c948;
    padding: 4px;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 4px;
    white-space: nowrap;
  `;
  
  container.style.position = 'relative';
  container.appendChild(preview);
}
})();