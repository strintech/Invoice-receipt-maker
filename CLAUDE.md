# Invoice & Receipt Maker App

## Project Overview

A Node.js/Express web application with PostgreSQL database for generating professional invoices and receipts. The app will be Dockerized for cross-platform compatibility.

### Tech Stack
- **Backend**: Node.js with Express
- **Database**: PostgreSQL (`pg`)
- **PDF Generation**: To be determined (e.g., PDFKit, Puppeteer)
- **Containerization**: Docker & Docker Compose

### Core Features
1. Generate invoices matching the reference format
2. Generate receipts matching the reference format
3. Save and manage company templates (logo, colors, company info)
4. Create new invoices/receipts from saved templates
5. Edit existing invoices/receipts
6. Separate tabs/views for invoices and receipts

---

## Input Fields Analysis

### Common Fields (Used in Both Invoice & Receipt)

#### My Company Information (Template-Saveable)
| Field | Description | Example |
|-------|-------------|---------|
| Company Logo | Image file upload | STRINTECH logo |
| Company Name | Legal business name | "STRINTECH" d.o.o. |
| Company Address | Street address | Dr. Fetaha Bećirbegovića 8c |
| Company City | City with postal code | 71000 Sarajevo, BiH |
| Tax ID (JIB/UID) | Tax identification number | 4203550420000 |
| VAT Number (PDV) | VAT registration (optional) | - |
| Bank Name | Name of bank | NLB Banka d.d. |
| SWIFT Code | Bank SWIFT/BIC | TBTUBA22X |
| IBAN | International bank account | BA391320010982891212 |
| Email | Contact email | info@strintech.dev |
| Phone | Contact phone | +387 61 700 933 |
| Primary Color | Brand color for styling | Orange (#F97316 or similar) |
| Secondary Color | Accent color | - |

#### Client Information (Per Document)
| Field | Description | Example |
|-------|-------------|---------|
| Client Company Name | Client's legal name | Planetsoft GmbH |
| Client Address | Client's street address | Landstraßer Hauptstraße 2 Top/M1.13.06 |
| Client City | Client's city with postal | 1030 Wien |
| Client Tax ID (UID) | Client's tax number | ATU78872935 |

#### Document Metadata
| Field | Description | Example |
|-------|-------------|---------|
| Document Number | Unique identifier | ST-1225-001 |
| Date | Issue date | 03.12.2025 |

#### Line Items (Multiple Rows)
| Field | Description | Example |
|-------|-------------|---------|
| Description | Service/product description | Website Development |
| Unit Price | Price per unit | 500 |
| Quantity | Number of units | 1 |
| Total | Calculated (unit price × qty) | 500 € |

---

### Invoice-Specific Fields

The invoice is a simpler document with the following structure:

| Section | Fields |
|---------|--------|
| Header | Logo, "INVOICE" title |
| My Company Info | Name, Address, City, Tax ID, Bank details |
| Client Info | Company, Address, City, UID |
| Document Info | Invoice No, Date |
| Line Items Table | Description, Unit Price, QTY, Total |
| Summary | Total amount with currency symbol (€) |

**Invoice Table Columns:**
- DESCRIPTION
- UNIT PRICE
- QTY
- TOTAL

---

### Receipt-Specific Fields

The receipt is a more detailed fiscal document with additional fields:

#### Additional Header Fields
| Field | Description | Example |
|-------|-------------|---------|
| Transaction Account (Tr. Racun) | Local bank account number | 1320202029686054 |

#### Additional Document Metadata
| Field | Description | Example |
|-------|-------------|---------|
| Place of Issue | City where issued | Sarajevo |
| Fiscal Receipt Number | Fiscal register number | 2 |

#### Extended Line Items Table
| Field | Description | Example |
|-------|-------------|---------|
| No. | Row number | 1 |
| Description | Service/product | Website Development |
| Price without VAT (EUR) | Net price | 500 |
| VAT | VAT percentage or amount | 0 |
| Sum | Line total | 500 |

#### Summary Section
| Field | Description | Example |
|-------|-------------|---------|
| Subtotal (Σ) | Sum of all line items | 500 |
| TOTAL (EUR) | Total in EUR | 500 |
| VAT % (EUR) | VAT amount | 0 |
| TOTAL SUM (EUR) | Grand total in EUR | 500 |
| TOTAL SUM (BAM) | Converted to local currency | 977.92 |
| Exchange Rate | EUR to BAM rate | ~1.95583 (fixed) |

#### VAT Explanation Section
| Field | Description | Example |
|-------|-------------|---------|
| VAT Note (English) | Explanation in English | "VAT is not calculated because the company is not registered in the VAT system..." |
| VAT Note (Local Language) | Explanation in local language | "PDV nije obračunat jer društvo nije u sistemu PDV-a..." |

#### Signature Section
| Field | Description | Example |
|-------|-------------|---------|
| Company Stamp | Image upload (optional) | Circular company stamp |
| Signature Image | Image upload (optional) | Handwritten signature |
| Signatory Name | Name of person signing | Nhan Muftić |

#### Footer Section
| Field | Description | Example |
|-------|-------------|---------|
| Full Company Info | Complete address line | "STRINTECH" d.o.o, Dr. Fetaha Bećirbegovića 8c, 71000 Sarajevo, Bosna i Hercegovina |
| Email | Contact email | info@strintech.dev |
| Phone | Contact phone | +387 61 700 933 |
| Company ID | Registration ID | 4203550420000 |

---

## Template System

### What Should Be Saved in Templates
Templates allow users to save company configurations for reuse:

1. **Company Profile**
   - All "My Company Information" fields
   - Logo image
   - Stamp image (for receipts)
   - Signature image (for receipts)
   - Brand colors

2. **Default Settings**
   - Default currency
   - Default VAT rate
   - Default VAT explanation texts
   - Document number prefix/format
   - Default place of issue

3. **Styling**
   - Primary color
   - Secondary color
   - Font preferences (if customizable)

### Template Operations
- Create new template
- Edit existing template
- Delete template
- Duplicate template
- Set default template
- Switch between templates when creating documents

---

## Database Schema (Planned)

### Tables
1. **templates** - Company templates with branding
2. **invoices** - Generated invoices
3. **receipts** - Generated receipts
4. **line_items** - Line items for invoices/receipts
5. **clients** - Saved client information (optional, for quick selection)

---

## Application Structure

### Pages/Views
1. **Dashboard** - Overview, recent documents
2. **Invoices Tab**
   - List of invoices
   - Create new invoice
   - Edit invoice
   - View/Download PDF
3. **Receipts Tab**
   - List of receipts
   - Create new receipt
   - Edit receipt
   - View/Download PDF
4. **Templates**
   - List of templates
   - Create/Edit template
   - Template settings

### API Endpoints (Planned)
- `GET/POST /api/templates` - Template CRUD
- `GET/POST /api/invoices` - Invoice CRUD
- `GET/POST /api/receipts` - Receipt CRUD
- `GET /api/invoices/:id/pdf` - Generate invoice PDF
- `GET /api/receipts/:id/pdf` - Generate receipt PDF
- `GET/POST /api/clients` - Client management (optional)

---

## Docker Configuration

### Requirements
- Dockerfile for the Node.js application
- Docker Compose for easy deployment
- Postgres service with a named volume for persistence
- Volume for uploaded images (logos, stamps, signatures)
- Environment variables for configuration

### docker-compose.yml Structure
```yaml
services:
  db:
    image: postgres:18-alpine
    volumes:
      - pgdata:/var/lib/postgresql   # Postgres data
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./uploads:/app/uploads  # Uploaded images
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgres://invoices:...@db:5432/invoices
    depends_on:
      db:
        condition: service_healthy
```

---

## PDF Generation Requirements

### Invoice PDF Layout (reference: Bosnian "faktura" ST-0726-001)
1. Three-column header: My company (left) | Logo (center) | Bank info incl. Tr. račun (right)
2. Document details (Broj fakture, Datum, Mjesto izdavanja, Način plaćanja, Broj fiskalnog računa, Broj ugovora) | Client (Kupac, Adresa, Grad, JIB)
3. Line items table with 5 columns (No., Opis, Cijena bez PDV, PDV, Ukupno) + ∑ row
4. Summary table (Iznos bez PDV / PDV / Iznos sa PDV)
5. PODACI O PDV (template VAT note), NAPOMENA (invoice notes), BIHUPP10 payment QR (`backend/services/bihupp.js`)
6. Signature lines (signatory | Zaprimio), footer with full contact info

### Receipt PDF Layout (reference: ST-1225-001)
1. Logo + "RECEIPT" title (left) | Company and bank info (right)
2. ISSUED TO client info | Receipt No + Date
3. Line items table with 4 columns (Description, Unit Price, QTY, Total) + TOTAL row

### Document Design (per template)
- `invoice_layout` / `receipt_layout`: `classic` (the two layouts above) or `modern`, `minimal`, `sidebar` (`backend/services/layouts.js`, shared by both document types via a document model built in `pdfGenerator.js`)
- `background_color`, `pattern` (10 SVG patterns in `backend/services/patterns.js`), `pattern_color`, `pattern_placement` (bottom/top/corner/full), `pattern_opacity`
- PDFs use zero page margins: `.page` padding is cloned onto every page (`box-decoration-break: clone`) and the pattern/footer are `position: fixed`, so backgrounds reach the paper edge on every page
- `GET /api/{invoices,receipts}/:id/pdf?bw=1` renders the ink-saver black & white version
- Document text follows the signed-in user's `language` setting (`en`/`bs`; `TEXT` in `pdfGenerator.js`): INVOICE/FAKTURA, RECEIPT/RAČUN, labels, and the template's `vat_note_en` vs `vat_note_local`. UI strings: `frontend/src/i18n.js`, keyed by the English text (`i18n.test.js` fails on untranslated `t('...')` keys)
- `POST /api/templates/preview` returns sample-document HTML for the live preview in the template form

---

## TODO (Implementation Order)

1. [ ] Set up project structure (Node.js/Express)
2. [ ] Configure PostgreSQL database with schema
3. [ ] Create Docker configuration
4. [ ] Build API endpoints for templates
5. [ ] Build API endpoints for invoices
6. [ ] Build API endpoints for receipts
7. [ ] Create frontend UI with tabs
8. [ ] Implement template management UI
9. [ ] Implement invoice creation/editing UI
10. [ ] Implement receipt creation/editing UI
11. [ ] Implement PDF generation for invoices
12. [ ] Implement PDF generation for receipts
13. [ ] Add file upload handling (logos, stamps, signatures)
14. [ ] Testing and refinement
