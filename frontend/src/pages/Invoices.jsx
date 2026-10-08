import { useState, useEffect } from 'react'
import { Routes, Route, Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import LineItems from '../components/LineItems'
import PdfActions from '../components/PdfActions'
import { useT } from '../i18n'

function InvoiceList() {
  const t = useT()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchInvoices()
  }, [])

  const fetchInvoices = async () => {
    try {
      const res = await fetch('/api/invoices')
      const data = await res.json()
      setInvoices(data)
    } catch (error) {
      console.error('Error fetching invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm(t('Are you sure you want to delete this invoice?'))) return

    try {
      await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
      fetchInvoices()
    } catch (error) {
      console.error('Error deleting invoice:', error)
    }
  }

  const handleDownloadPDF = async (id, number) => {
    try {
      const res = await fetch(`/api/invoices/${id}/pdf`)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${number}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading PDF:', error)
    }
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatCurrency = (amount, currency = 'EUR') => {
    return `${parseFloat(amount).toFixed(2)} ${currency}`
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div>{t('Loading...')}</div>
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('Invoices')}</h1>
        <Link to="/invoices/new" className="btn btn-primary">{t('New Invoice')}</Link>
      </div>

      {invoices.length > 0 ? (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>{t('Invoice No.')}</th>
                <th>{t('Client')}</th>
                <th>{t('Date')}</th>
                <th>{t('Total')}</th>
                <th>{t('Status')}</th>
                <th>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(invoice => (
                <tr key={invoice.id}>
                  <td>
                    <Link to={`/invoices/${invoice.id}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
                      {invoice.invoice_number}
                    </Link>
                  </td>
                  <td>{invoice.client_name || '-'}</td>
                  <td>{formatDate(invoice.date)}</td>
                  <td>{formatCurrency(invoice.total, invoice.currency)}</td>
                  <td>
                    <span className={`badge badge-${invoice.status}`}>{{ draft: t('Draft'), sent: t('Sent'), paid: t('Paid') }[invoice.status] ?? invoice.status}</span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDownloadPDF(invoice.id, invoice.invoice_number)}
                        title={t('Download PDF')}
                      >
                        PDF
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/invoices/${invoice.id}`)}
                      >
                        {t('Edit')}
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/invoices/new?from=${invoice.id}`)}
                      >
                        {t('Fork')}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(invoice.id)}
                      >
                        {t('Delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <h3>{t('No Invoices Yet')}</h3>
            <p>{t('Create your first invoice to get started.')}</p>
            <Link to="/invoices/new" className="btn btn-primary" style={{ marginTop: '15px' }}>
              {t('Create First Invoice')}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function InvoiceForm() {
  const t = useT()
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)
  const [searchParams] = useSearchParams()
  const fromId = isEditing ? null : searchParams.get('from')

  const [formData, setFormData] = useState({
    template_id: '',
    client_id: '',
    invoice_number: '',
    date: new Date().toISOString().split('T')[0],
    currency: 'EUR',
    status: 'draft',
    notes: '',
    place_of_issue: '',
    payment_method: t('Bank transfer'),
    fiscal_number: '',
    contract_number: '',
    vat_rate: 0
  })

  const [lineItems, setLineItems] = useState([
    { description: '', unit_price: '', quantity: 1 }
  ])

  const [templates, setTemplates] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchTemplatesAndClients()
    if (isEditing) {
      fetchInvoice(id)
    } else {
      fetchNextNumber()
      if (fromId) fetchInvoice(fromId, true)
    }
  }, [id, fromId])

  const fetchTemplatesAndClients = async () => {
    try {
      const [templatesRes, clientsRes] = await Promise.all([
        fetch('/api/templates'),
        fetch('/api/clients')
      ])
      const templatesData = await templatesRes.json()
      const clientsData = await clientsRes.json()
      setTemplates(templatesData)
      setClients(clientsData)

      // Set default template if available and not editing or forking
      if (!isEditing && !fromId) {
        const defaultTemplate = templatesData.find(t => t.is_default)
        if (defaultTemplate) {
          setFormData(prev => ({
            ...prev,
            template_id: defaultTemplate.id,
            currency: defaultTemplate.default_currency || 'EUR',
            vat_rate: defaultTemplate.default_vat_rate || 0,
            place_of_issue: defaultTemplate.default_place_of_issue || ''
          }))
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  const fetchNextNumber = async () => {
    try {
      const res = await fetch('/api/next-number/invoice')
      const data = await res.json()
      setFormData(prev => ({ ...prev, invoice_number: data.number }))
    } catch (error) {
      console.error('Error fetching next number:', error)
    }
  }

  const fetchInvoice = async (sourceId, fork = false) => {
    try {
      const res = await fetch(`/api/invoices/${sourceId}`)
      const data = await res.json()
      const loaded = {
        template_id: data.template_id || '',
        client_id: data.client_id || '',
        invoice_number: data.invoice_number,
        date: data.date,
        currency: data.currency,
        status: data.status,
        notes: data.notes || '',
        place_of_issue: data.place_of_issue || '',
        payment_method: data.payment_method || '',
        fiscal_number: data.fiscal_number || '',
        contract_number: data.contract_number || '',
        vat_rate: data.vat_rate || 0
      }
      // A fork keeps the new number and today's date and starts as a draft without a fiscal number
      setFormData(prev => fork ? { ...loaded, invoice_number: prev.invoice_number, date: prev.date, status: 'draft', fiscal_number: '' } : loaded)
      if (data.line_items && data.line_items.length > 0) {
        setLineItems(data.line_items)
      }
    } catch (error) {
      console.error('Error fetching invoice:', error)
      setError(t('Failed to load invoice'))
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleTemplateChange = (e) => {
    const templateId = e.target.value
    const template = templates.find(t => t.id === parseInt(templateId))
    setFormData(prev => ({
      ...prev,
      template_id: templateId,
      ...(template && {
        currency: template.default_currency || prev.currency,
        vat_rate: template.default_vat_rate ?? prev.vat_rate,
        place_of_issue: template.default_place_of_issue || prev.place_of_issue
      })
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validate line items
    const validLineItems = lineItems.filter(item =>
      item.description && item.unit_price
    )

    if (validLineItems.length === 0) {
      setError(t('Please add at least one line item'))
      setLoading(false)
      return
    }

    try {
      const url = isEditing ? `/api/invoices/${id}` : '/api/invoices'
      const method = isEditing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          template_id: formData.template_id || null,
          client_id: formData.client_id || null,
          line_items: validLineItems
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save invoice')
      }

      navigate('/invoices')
    } catch (error) {
      setError(t(error.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{isEditing ? t('Edit Invoice') : fromId ? t('Fork Invoice') : t('New Invoice')}</h1>
        {isEditing && <PdfActions url={`/api/invoices/${id}/pdf`} filename={formData.invoice_number} />}
      </div>

      <form onSubmit={handleSubmit}>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '20px' }}>{t('Invoice Details')}</h3>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('Template')}</label>
              <select
                name="template_id"
                className="form-select"
                value={formData.template_id}
                onChange={handleTemplateChange}
              >
                <option value="">{t('Select template...')}</option>
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name} {template.is_default ? t('(Default)') : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('Client')}</label>
              <select
                name="client_id"
                className="form-select"
                value={formData.client_id}
                onChange={handleChange}
              >
                <option value="">{t('Select client...')}</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.company_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('Invoice Number *')}</label>
              <input
                type="text"
                name="invoice_number"
                className="form-input"
                value={formData.invoice_number}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('Date *')}</label>
              <input
                type="date"
                name="date"
                className="form-input"
                value={formData.date}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('Currency')}</label>
              <select
                name="currency"
                className="form-select"
                value={formData.currency}
                onChange={handleChange}
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="BAM">BAM</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('Status')}</label>
              <select
                name="status"
                className="form-select"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="draft">{t('Draft')}</option>
                <option value="sent">{t('Sent')}</option>
                <option value="paid">{t('Paid')}</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('Place of Issue')}</label>
              <input
                type="text"
                name="place_of_issue"
                className="form-input"
                value={formData.place_of_issue}
                onChange={handleChange}
                placeholder={t('City')}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('Payment Method')}</label>
              <input
                type="text"
                name="payment_method"
                className="form-input"
                value={formData.payment_method}
                onChange={handleChange}
                placeholder={t('Bank transfer')}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('Fiscal Receipt No.')}</label>
              <input
                type="text"
                name="fiscal_number"
                className="form-input"
                value={formData.fiscal_number}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('Contract No.')}</label>
              <input
                type="text"
                name="contract_number"
                className="form-input"
                value={formData.contract_number}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('VAT Rate (%)')}</label>
              <input
                type="number"
                name="vat_rate"
                className="form-input"
                value={formData.vat_rate}
                onChange={handleChange}
                step="0.01"
                min="0"
                max="100"
              />
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '20px' }}>{t('Line Items')}</h3>
          <LineItems
            items={lineItems}
            onChange={setLineItems}
            currency={formData.currency}
          />
        </div>

        <div className="card">
          <div className="form-group">
            <label className="form-label">{t('Notes (printed on the invoice)')}</label>
            <textarea
              name="notes"
              className="form-textarea"
              value={formData.notes}
              onChange={handleChange}
              placeholder={t('Additional notes...')}
              rows={6}
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/invoices')}>
            {t('Cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? t('Saving...') : (isEditing ? t('Update Invoice') : t('Create Invoice'))}
          </button>
        </div>
      </form>
    </div>
  )
}

function Invoices() {
  return (
    <Routes>
      <Route index element={<InvoiceList />} />
      <Route path="new" element={<InvoiceForm />} />
      <Route path=":id" element={<InvoiceForm />} />
    </Routes>
  )
}

export default Invoices
