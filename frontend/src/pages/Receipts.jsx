import { useState, useEffect } from 'react'
import { Routes, Route, Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import LineItems from '../components/LineItems'
import PdfActions from '../components/PdfActions'
import { useT } from '../i18n'

function ReceiptList() {
  const t = useT()
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchReceipts()
  }, [])

  const fetchReceipts = async () => {
    try {
      const res = await fetch('/api/receipts')
      const data = await res.json()
      setReceipts(data)
    } catch (error) {
      console.error('Error fetching receipts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm(t('Are you sure you want to delete this receipt?'))) return

    try {
      await fetch(`/api/receipts/${id}`, { method: 'DELETE' })
      fetchReceipts()
    } catch (error) {
      console.error('Error deleting receipt:', error)
    }
  }

  const handleDownloadPDF = async (id, number) => {
    try {
      const res = await fetch(`/api/receipts/${id}/pdf`)
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
        <h1 className="page-title">{t('Receipts')}</h1>
        <Link to="/receipts/new" className="btn btn-primary">{t('New Receipt')}</Link>
      </div>

      {receipts.length > 0 ? (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>{t('Receipt No.')}</th>
                <th>{t('Client')}</th>
                <th>{t('Date')}</th>
                <th>{t('Total')}</th>
                <th>{t('Status')}</th>
                <th>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map(receipt => (
                <tr key={receipt.id}>
                  <td>
                    <Link to={`/receipts/${receipt.id}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
                      {receipt.receipt_number}
                    </Link>
                  </td>
                  <td>{receipt.client_name || '-'}</td>
                  <td>{formatDate(receipt.date)}</td>
                  <td>{formatCurrency(receipt.total, receipt.currency)}</td>
                  <td>
                    <span className={`badge badge-${receipt.status}`}>{{ draft: t('Draft'), sent: t('Sent'), paid: t('Paid') }[receipt.status] ?? receipt.status}</span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDownloadPDF(receipt.id, receipt.receipt_number)}
                        title={t('Download PDF')}
                      >
                        PDF
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/receipts/${receipt.id}`)}
                      >
                        {t('Edit')}
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/receipts/new?from=${receipt.id}`)}
                      >
                        {t('Fork')}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(receipt.id)}
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0c1.1.128 1.907 1.077 1.907 2.185ZM9.75 9h.008v.008H9.75V9Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm4.125 4.5h.008v.008h-.008V13.5Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
            <h3>{t('No Receipts Yet')}</h3>
            <p>{t('Create your first receipt to get started.')}</p>
            <Link to="/receipts/new" className="btn btn-primary" style={{ marginTop: '15px' }}>
              {t('Create First Receipt')}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function ReceiptForm() {
  const t = useT()
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)
  const [searchParams] = useSearchParams()
  const fromId = isEditing ? null : searchParams.get('from')

  const [formData, setFormData] = useState({
    template_id: '',
    client_id: '',
    receipt_number: '',
    date: new Date().toISOString().split('T')[0],
    currency: 'EUR',
    status: 'draft',
    notes: ''
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
      fetchReceipt(id)
    } else {
      fetchNextNumber()
      if (fromId) fetchReceipt(fromId, true)
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
            currency: defaultTemplate.default_currency || 'EUR'
          }))
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  const fetchNextNumber = async () => {
    try {
      const res = await fetch('/api/next-number/receipt')
      const data = await res.json()
      setFormData(prev => ({ ...prev, receipt_number: data.number }))
    } catch (error) {
      console.error('Error fetching next number:', error)
    }
  }

  const fetchReceipt = async (sourceId, fork = false) => {
    try {
      const res = await fetch(`/api/receipts/${sourceId}`)
      const data = await res.json()
      const loaded = {
        template_id: data.template_id || '',
        client_id: data.client_id || '',
        receipt_number: data.receipt_number,
        date: data.date,
        currency: data.currency,
        status: data.status,
        notes: data.notes || ''
      }
      // A fork keeps the new number and today's date and starts as a draft
      setFormData(prev => fork ? { ...loaded, receipt_number: prev.receipt_number, date: prev.date, status: 'draft' } : loaded)
      if (data.line_items && data.line_items.length > 0) {
        setLineItems(data.line_items)
      }
    } catch (error) {
      console.error('Error fetching receipt:', error)
      setError(t('Failed to load receipt'))
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleTemplateChange = (e) => {
    const templateId = e.target.value
    setFormData(prev => ({ ...prev, template_id: templateId }))

    if (templateId) {
      const template = templates.find(t => t.id === parseInt(templateId))
      if (template) {
        setFormData(prev => ({
          ...prev,
          template_id: templateId,
          currency: template.default_currency || prev.currency
        }))
      }
    }
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
      const url = isEditing ? `/api/receipts/${id}` : '/api/receipts'
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
        throw new Error(data.error || 'Failed to save receipt')
      }

      navigate('/receipts')
    } catch (error) {
      setError(t(error.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{isEditing ? t('Edit Receipt') : fromId ? t('Fork Receipt') : t('New Receipt')}</h1>
        {isEditing && <PdfActions url={`/api/receipts/${id}/pdf`} filename={formData.receipt_number} />}
      </div>

      <form onSubmit={handleSubmit}>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '20px' }}>{t('Receipt Details')}</h3>
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
              <label className="form-label">{t('Receipt Number *')}</label>
              <input
                type="text"
                name="receipt_number"
                className="form-input"
                value={formData.receipt_number}
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
            <label className="form-label">{t('Notes')}</label>
            <textarea
              name="notes"
              className="form-textarea"
              value={formData.notes}
              onChange={handleChange}
              placeholder={t('Additional notes...')}
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/receipts')}>
            {t('Cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? t('Saving...') : (isEditing ? t('Update Receipt') : t('Create Receipt'))}
          </button>
        </div>
      </form>
    </div>
  )
}

function Receipts() {
  return (
    <Routes>
      <Route index element={<ReceiptList />} />
      <Route path="new" element={<ReceiptForm />} />
      <Route path=":id" element={<ReceiptForm />} />
    </Routes>
  )
}

export default Receipts
