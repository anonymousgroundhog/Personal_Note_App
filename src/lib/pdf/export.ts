// Dynamically load jsPDF for PDF generation with link support
async function getJsPDF() {
  // Try to get jsPDF from various sources
  const html2pdf = await import('html2pdf.js')

  // html2pdf.js bundles jsPDF, so we can access it
  if (html2pdf.jsPDF) {
    return html2pdf.jsPDF
  }
  if (html2pdf.default?.jsPDF) {
    return html2pdf.default.jsPDF
  }

  // Fallback
  return (window as any).jsPDF
}

// Fallback function using html2pdf for older environments
async function generatePdfWithHtml2pdf(
  container: HTMLElement,
  filename: string
): Promise<Blob> {
  const html2pdf = await import('html2pdf.js')

  return new Promise<Blob>((resolve, reject) => {
    const options = {
      margin: [10, 10, 10, 10], // in mm
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
    }

    html2pdf
      .default()
      .set(options)
      .from(container)
      .toPdf()
      .output('blob')
      .then((blob: Blob) => resolve(blob))
      .catch((err: Error) => reject(err))
  })
}

// Prose styling that matches the markdown preview
const PROSE_STYLES = `
  <style>
    body { margin: 0; padding: 0; }
    .prose-content {
      font-family: system-ui, -apple-system, sans-serif;
      color: #000;
      background: #fff;
      line-height: 1.6;
      padding: 20px;
    }
    .prose-content h1 { font-size: 2em; font-weight: 700; margin: 0.67em 0; scroll-margin-top: 80px; }
    .prose-content h2 { font-size: 1.5em; font-weight: 600; margin: 0.75em 0; scroll-margin-top: 80px; }
    .prose-content h3 { font-size: 1.25em; font-weight: 600; margin: 0.83em 0; scroll-margin-top: 80px; }
    .prose-content h4 { font-size: 1.1em; font-weight: 600; margin: 1em 0; scroll-margin-top: 80px; }
    .prose-content h5 { font-size: 1em; font-weight: 600; margin: 1.17em 0; scroll-margin-top: 80px; }
    .prose-content h6 { font-size: 0.9em; font-weight: 600; margin: 1.33em 0; scroll-margin-top: 80px; }
    .prose-content p { margin: 1em 0; }
    .prose-content ul, .prose-content ol { margin: 1em 0; padding-left: 2em; }
    .prose-content li { margin: 0.5em 0; }
    .prose-content code {
      font-family: 'Courier New', monospace;
      background: #f5f5f5;
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-size: 0.9em;
    }
    .prose-content pre {
      background: #f5f5f5;
      padding: 1em;
      border-radius: 4px;
      overflow-x: auto;
      margin: 1em 0;
    }
    .prose-content pre code {
      background: none;
      padding: 0;
    }
    .prose-content blockquote {
      border-left: 4px solid #ccc;
      margin: 1em 0;
      padding-left: 1em;
      color: #666;
    }
    .prose-content table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
    }
    .prose-content table th,
    .prose-content table td {
      border: 1px solid #ddd;
      padding: 0.75em;
      text-align: left;
    }
    .prose-content table th {
      background: #f9f9f9;
      font-weight: 600;
    }
    .prose-content a {
      color: #0066cc;
      text-decoration: none;
    }
    .prose-content a:hover {
      text-decoration: underline;
    }
    .prose-content a[href^="#"] {
      color: #0066cc;
      cursor: pointer;
    }
    .prose-content strong { font-weight: 600; }
    .prose-content em { font-style: italic; }
    .prose-content hr {
      border: none;
      border-top: 1px solid #ddd;
      margin: 2em 0;
    }
  </style>
`

export async function exportNoteToPdf(
  noteName: string,
  htmlContent: string,
  saveToFileSystem?: (pdfBlob: Blob, filename: string) => Promise<void>
) {
  try {
    const filename = `${noteName}.pdf`

    // Get jsPDF class
    const jsPDF = await getJsPDF()

    // Create a container with proper styling and content
    const container = document.createElement('div')
    container.className = 'prose-content'
    container.innerHTML = htmlContent
    container.style.padding = '20px'
    container.style.fontFamily = 'system-ui, -apple-system, sans-serif'
    container.style.color = '#000'
    container.style.backgroundColor = '#fff'
    container.style.lineHeight = '1.6'

    let pdfBlob: Blob

    // Try using jsPDF's html() method if available (better link support)
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      // Check if html() method exists
      if (typeof (pdf as any).html === 'function') {
        // Add the styled HTML to the PDF
        // jsPDF's html() method preserves the HTML structure better and supports internal links
        await (pdf as any).html(container, {
          margin: [10, 10, 10, 10],
          useCORS: true,
          logging: false,
          windowHeight: container.scrollHeight,
          // This enables internal PDF links for anchor tags
          callback: undefined
        })

        pdfBlob = pdf.output('blob')
      } else {
        // Fallback: use html2pdf approach
        pdfBlob = await generatePdfWithHtml2pdf(container, filename)
      }
    } catch (error) {
      console.warn('jsPDF html() method failed, falling back to html2pdf:', error)
      // Fallback: use html2pdf approach
      pdfBlob = await generatePdfWithHtml2pdf(container, filename)
    }

    // If a save handler is provided, use it (for file system API)
    if (saveToFileSystem) {
      await saveToFileSystem(pdfBlob, filename)
    } else {
      // Fallback: download directly
      const url = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }

    return pdfBlob
  } catch (error) {
    console.error('PDF export error:', error)
    throw error
  }
}

/**
 * Save a blob to the file system using the File System Access API
 * Shows a file picker dialog for the user to select where to save
 */
export async function saveToFileSystem(blob: Blob, suggestedName: string): Promise<void> {
  try {
    // Check if the File System Access API is available
    if (!('showSaveFilePicker' in window)) {
      throw new Error('File System Access API is not supported in this browser. Using download instead.')
    }

    const handle = await (window as any).showSaveFilePicker({
      suggestedName,
      types: [
        {
          description: 'PDF files',
          accept: { 'application/pdf': ['.pdf'] }
        }
      ]
    })

    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
  } catch (error: any) {
    // User canceled the save dialog - this is normal
    if (error.name === 'AbortError') {
      return
    }

    // If File System API is not supported, fall back to download
    if (!('showSaveFilePicker' in window)) {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = suggestedName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      return
    }

    throw error
  }
}
