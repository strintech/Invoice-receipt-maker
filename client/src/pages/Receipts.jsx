import { useState, useEffect } from 'react'
import { Routes, Route, Link, useNavigate, useParams } from 'react-router-dom'
import LineItems from '../components/LineItems'

function ReceiptList() {
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
    if (!confirm('Are you sure you want to delete this receipt?')) return

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
    return <div className="loading"><div className="spinner"></div>Loading...</div>
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Receipts</h1>
        <Link to="/receipts/new" className="btn btn-primary">New Receipt</Link>
      </div>

      {receipts.length > 0 ? (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Receipt No.</th>
                <th>Client</th>
                <th>Date</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
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
                    <span className={`badge badge-${receipt.status}`}>{receipt.status}</span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDownloadPDF(receipt.id, receipt.receipt_number)}
                        title="Download PDF"
                      >
                        PDF
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/receipts/${receipt.id}`)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(receipt.id)}
                      >
                        Delete
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
            <h3>No Receipts Yet</h3>
            <p>Create your first receipt to get started.</p>
            <Link to="/receipts/new" className="btn btn-primary" style={{ marginTop: '15px' }}>
              Create First Receipt
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function ReceiptForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)

  const [formData, setFormData] = useState({
    template_id: '',
    client_id: '',
    receipt_number: '',
    date: new Date().toISOString().split('T')[0],
    place_of_issue: '',
    fiscal_number: '',
    currency: 'EUR',
    secondary_currency: 'BAM',
    exchange_rate: 1.95583,
    vat_rate: 0,
    vat_note_en: '',
    vat_note_local: '',
    status: 'draft',
    notes: ''
  })

  const [lineItems, setLineItems] = useState([
    { description: '', unit_price: '', quantity: 1, vat_rate: 0 }
  ])

  const [templates, setTemplates] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Calculated totals
  const [totals, setTotals] = useState({
    subtotal: 0,
    vatAmount: 0,
    total: 0,
    totalSecondary: 0
  })

  useEffect(() => {
    fetchTemplatesAndClients()
    if (isEditing) {
      fetchReceipt()
    } else {
      fetchNextNumber()
    }
  }, [id])

  useEffect(() => {
    calculateTotals()
  }, [lineItems, formData.vat_rate, formData.exchange_rate])

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => {
      return sum + ((parseFloat(item.unit_price) || 0) * (parseFloat(item.quantity) || 0))
    }, 0)
    const vatAmount = subtotal * ((parseFloat(formData.vat_rate) || 0) / 100)
    const total = subtotal + vatAmount
    const totalSecondary = total * (parseFloat(formData.exchange_rate) || 1)

    setTotals({ subtotal, vatAmount, total, totalSecondary })
  }

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

      // Set default template if available and not editing
      if (!isEditing) {
        const defaultTemplate = templatesData.find(t => t.is_default)
        if (defaultTemplate) {
          setFormData(prev => ({
            ...prev,
            template_id: defaultTemplate.id,
            currency: defaultTemplate.default_currency || 'EUR',
            vat_rate: defaultTemplate.default_vat_rate || 0,
            place_of_issue: defaultTemplate.default_place_of_issue || '',
            vat_note_en: defaultTemplate.vat_note_en || '',
            vat_note_local: defaultTemplate.vat_note_local || ''
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

  const fetchReceipt = async () => {
    try {
      const res = await fetch(`/api/receipts/${id}`)
      const data = await res.json()
      setFormData({
        template_id: data.template_id || '',
        client_id: data.client_id || '',
        receipt_number: data.receipt_number,
        date: data.date,
        place_of_issue: data.place_of_issue || '',
        fiscal_number: data.fiscal_number || '',
        currency: data.currency,
        secondary_currency: data.secondary_currency || 'BAM',
        exchange_rate: data.exchange_rate || 1.95583,
        vat_rate: data.vat_rate || 0,
        vat_note_en: data.vat_note_en || '',
        vat_note_local: data.vat_note_local || '',
        status: data.status,
        notes: data.notes || ''
      })
      if (data.line_items && data.line_items.length > 0) {
        setLineItems(data.line_items)
      }
    } catch (error) {
      console.error('Error fetching receipt:', error)
      setError('Failed to load receipt')
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
          currency: template.default_currency || prev.currency,
          vat_rate: template.default_vat_rate ?? prev.vat_rate,
          place_of_issue: template.default_place_of_issue || prev.place_of_issue,
          vat_note_en: template.vat_note_en || prev.vat_note_en,
          vat_note_local: template.vat_note_local || prev.vat_note_local
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
      setError('Please add at least one line item')
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
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!id) return

    try {
      const res = await fetch(`/api/receipts/${id}/pdf`)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${formData.receipt_number}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading PDF:', error)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{isEditing ? 'Edit Receipt' : 'New Receipt'}</h1>
        {isEditing && (
          <button className="btn btn-secondary" onClick={handleDownloadPDF}>
            Download PDF
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '20px' }}>Receipt Details</h3>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Template</label>
              <select
                name="template_id"
                className="form-select"
                value={formData.template_id}
                onChange={handleTemplateChange}
              >
                <option value="">Select template...</option>
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name} {template.is_default ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Client</label>
              <select
                name="client_id"
                className="form-select"
                value={formData.client_id}
                onChange={handleChange}
              >
                <option value="">Select client...</option>
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
              <label className="form-label">Receipt Number *</label>
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
              <label className="form-label">Date *</label>
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
              <label className="form-label">Place of Issue</label>
              <input
                type="text"
                name="place_of_issue"
                className="form-input"
                value={formData.place_of_issue}
                onChange={handleChange}
                placeholder="City"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Fiscal Number</label>
              <input
                type="text"
                name="fiscal_number"
                className="form-input"
                value={formData.fiscal_number}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Currency</label>
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
              <label className="form-label">Secondary Currency</label>
              <select
                name="secondary_currency"
                className="form-select"
                value={formData.secondary_currency}
                onChange={handleChange}
              >
                <option value="BAM">BAM</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Exchange Rate</label>
              <input
                type="number"
                name="exchange_rate"
                className="form-input"
                value={formData.exchange_rate}
                onChange={handleChange}
                step="0.00001"
                min="0"
              />
            </div>
            <div className="form-group">
              <label className="form-label">VAT Rate (%)</label>
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
            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                name="status"
                className="form-select"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '20px' }}>Line Items</h3>
          <LineItems
            items={lineItems}
            onChange={setLineItems}
            showVat={true}
            currency={formData.currency}
          />
        </div>

        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '20px' }}>Summary</h3>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <table style={{ width: '300px' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '8px', fontWeight: 600 }}>Subtotal:</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{totals.subtotal.toFixed(2)} {formData.currency}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px', fontWeight: 600 }}>VAT ({formData.vat_rate}%):</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{totals.vatAmount.toFixed(2)} {formData.currency}</td>
                </tr>
                <tr style={{ background: 'var(--primary)', color: 'white' }}>
                  <td style={{ padding: '12px', fontWeight: 700 }}>TOTAL:</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>{totals.total.toFixed(2)} {formData.currency}</td>
                </tr>
                {formData.secondary_currency !== formData.currency && (
                  <tr style={{ background: 'var(--gray-100)' }}>
                    <td style={{ padding: '8px', fontWeight: 600 }}>Total ({formData.secondary_currency}):</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{totals.totalSecondary.toFixed(2)} {formData.secondary_currency}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {parseFloat(formData.vat_rate) === 0 && (
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '20px' }}>VAT Exemption Notes</h3>
            <div className="form-group">
              <label className="form-label">VAT Note (English)</label>
              <textarea
                name="vat_note_en"
                className="form-textarea"
                value={formData.vat_note_en}
                onChange={handleChange}
                placeholder="Explanation for VAT exemption in English"
              />
            </div>
            <div className="form-group">
              <label className="form-label">VAT Note (Local Language)</label>
              <textarea
                name="vat_note_local"
                className="form-textarea"
                value={formData.vat_note_local}
                onChange={handleChange}
                placeholder="Explanation for VAT exemption in local language"
              />
            </div>
          </div>
        )}

        <div className="card">
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              name="notes"
              className="form-textarea"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Additional notes..."
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/receipts')}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : (isEditing ? 'Update Receipt' : 'Create Receipt')}
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
