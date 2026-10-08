import { useState, useEffect } from 'react'
import { Routes, Route, Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import TemplateDesign from '../components/TemplateDesign'
import { useT } from '../i18n'

const IMAGE_FIELDS = ['logo', 'stamp', 'signature']

function ImageUpload({ field, label, preview, onChange, onRemove }) {
  const t = useT()
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div className="file-upload" onClick={() => document.getElementById(`${field}-input`).click()}>
        <input
          type="file"
          id={`${field}-input`}
          accept="image/*"
          onChange={(e) => onChange(e, field)}
        />
        {preview ? (
          <div className="file-preview">
            <img src={preview} alt={`${label} preview`} />
            <span>{t('Click to change')}</span>
          </div>
        ) : (
          <span>{t('Click to upload')}</span>
        )}
      </div>
      {preview && (
        <button type="button" className="btn btn-danger btn-sm" style={{ marginTop: '8px' }} onClick={() => onRemove(field)}>
          {t('Remove')}
        </button>
      )}
    </div>
  )
}

function TemplateList() {
  const t = useT()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates')
      const data = await res.json()
      setTemplates(data)
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm(t('Are you sure you want to delete this template?'))) return

    try {
      await fetch(`/api/templates/${id}`, { method: 'DELETE' })
      fetchTemplates()
    } catch (error) {
      console.error('Error deleting template:', error)
    }
  }

  const handleSetDefault = async (id) => {
    try {
      await fetch(`/api/templates/${id}/set-default`, { method: 'POST' })
      fetchTemplates()
    } catch (error) {
      console.error('Error setting default:', error)
    }
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div>{t('Loading...')}</div>
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('Templates')}</h1>
        <Link to="/templates/new" className="btn btn-primary">{t('New Template')}</Link>
      </div>

      {templates.length > 0 ? (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>{t('Name')}</th>
                <th>{t('Company')}</th>
                <th>{t('Email')}</th>
                <th>{t('Default')}</th>
                <th>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(template => (
                <tr key={template.id}>
                  <td>
                    <Link to={`/templates/${template.id}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
                      {template.name}
                    </Link>
                  </td>
                  <td>{template.company_name}</td>
                  <td>{template.email || '-'}</td>
                  <td>
                    {template.is_default ? (
                      <span className="badge badge-paid">{t('Default')}</span>
                    ) : (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleSetDefault(template.id)}
                      >
                        {t('Set Default')}
                      </button>
                    )}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/templates/${template.id}`)}
                      >
                        {t('Edit')}
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/templates/new?from=${template.id}`)}
                      >
                        {t('Fork')}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(template.id)}
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            <h3>{t('No Templates Yet')}</h3>
            <p>{t('Create a template to save your company information for quick invoice/receipt generation.')}</p>
            <Link to="/templates/new" className="btn btn-primary" style={{ marginTop: '15px' }}>
              {t('Create First Template')}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function TemplateForm() {
  const t = useT()
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)
  const [searchParams] = useSearchParams()
  const fromId = isEditing ? null : searchParams.get('from')

  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    company_address: '',
    company_city: '',
    company_country: '',
    tax_id: '',
    vat_number: '',
    bank_name: '',
    bank_account: '',
    swift_code: '',
    iban: '',
    email: '',
    phone: '',
    signatory_name: '',
    primary_color: '#F97316',
    secondary_color: '#1F2937',
    default_currency: 'EUR',
    default_vat_rate: 0,
    vat_note_en: 'VAT is not calculated because the company is not registered in the VAT system according to Article 57, Paragraph 1 of the VAT Law.',
    vat_note_local: 'PDV nije obračunat jer društvo nije u sistemu PDV-a, u skladu sa Zakonom o PDV-u Bosne i Hercegovine.',
    invoice_prefix: 'INV',
    receipt_prefix: 'RCP',
    default_place_of_issue: '',
    is_default: false,
    invoice_layout: 'classic',
    receipt_layout: 'classic',
    background_color: '#FFFFFF',
    pattern: 'none',
    pattern_color: '#F97316',
    pattern_placement: 'bottom',
    pattern_opacity: 1
  })

  const [files, setFiles] = useState({
    logo: null,
    stamp: null,
    signature: null
  })

  const [previews, setPreviews] = useState({
    logo: null,
    stamp: null,
    signature: null
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isEditing || fromId) {
      fetchTemplate(id || fromId)
    }
  }, [id, fromId])

  const fetchTemplate = async (sourceId) => {
    try {
      const res = await fetch(`/api/templates/${sourceId}`)
      const data = await res.json()
      setFormData({
        ...data,
        ...(fromId && { name: t('{name} (copy)', { name: data.name }) }),
        is_default: fromId ? false : Boolean(data.is_default)
      })
      for (const field of IMAGE_FIELDS) {
        const filePath = data[`${field}_path`]
        if (filePath) setPreviews(prev => ({ ...prev, [field]: '/uploads/' + filePath.split('/').pop() }))
      }
    } catch (error) {
      console.error('Error fetching template:', error)
      setError(t('Failed to load template'))
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleFileChange = (e, field) => {
    const file = e.target.files[0]
    if (file) {
      setFiles(prev => ({ ...prev, [field]: file }))
      setPreviews(prev => ({ ...prev, [field]: URL.createObjectURL(file) }))
    }
  }

  const handleRemoveFile = (field) => {
    setFiles(prev => ({ ...prev, [field]: null }))
    setPreviews(prev => ({ ...prev, [field]: null }))
    document.getElementById(`${field}-input`).value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const formDataToSend = new FormData()

      Object.keys(formData).forEach(key => {
        if (formData[key] !== null && formData[key] !== undefined) {
          formDataToSend.append(key, formData[key])
        }
      })

      for (const field of IMAGE_FIELDS) {
        if (files[field]) {
          formDataToSend.append(field, files[field])
        } else if (!previews[field]) {
          formDataToSend.append(`remove_${field}`, 'true')
        } else if (fromId) {
          // A fork uploads its own copy, so deleting either template never removes the other's image
          const blob = await fetch(previews[field]).then(r => r.blob())
          formDataToSend.append(field, blob, previews[field].split('/').pop())
        }
      }

      const url = isEditing ? `/api/templates/${id}` : '/api/templates'
      const method = isEditing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        body: formDataToSend
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save template')
      }

      navigate('/templates')
    } catch (error) {
      setError(t(error.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{isEditing ? t('Edit Template') : fromId ? t('Fork Template') : t('New Template')}</h1>
      </div>

      <form onSubmit={handleSubmit}>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '20px' }}>{t('Basic Information')}</h3>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('Template Name *')}</label>
              <input
                type="text"
                name="name"
                className="form-input"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder={t('e.g., My Company Template')}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('Company Name *')}</label>
              <input
                type="text"
                name="company_name"
                className="form-input"
                value={formData.company_name}
                onChange={handleChange}
                required
                placeholder={t('Legal company name')}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('Address')}</label>
              <input
                type="text"
                name="company_address"
                className="form-input"
                value={formData.company_address}
                onChange={handleChange}
                placeholder={t('Street address')}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('City')}</label>
              <input
                type="text"
                name="company_city"
                className="form-input"
                value={formData.company_city}
                onChange={handleChange}
                placeholder={t('City, Postal Code')}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('Country')}</label>
              <input
                type="text"
                name="company_country"
                className="form-input"
                value={formData.company_country}
                onChange={handleChange}
                placeholder={t('Country')}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('Tax ID (JIB/UID)')}</label>
              <input
                type="text"
                name="tax_id"
                className="form-input"
                value={formData.tax_id}
                onChange={handleChange}
                placeholder={t('Tax identification number')}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('VAT Number (PDV)')}</label>
              <input
                type="text"
                name="vat_number"
                className="form-input"
                value={formData.vat_number}
                onChange={handleChange}
                placeholder={t('VAT registration number')}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('Email')}</label>
              <input
                type="email"
                name="email"
                className="form-input"
                value={formData.email}
                onChange={handleChange}
                placeholder="company@example.com"
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('Phone')}</label>
              <input
                type="text"
                name="phone"
                className="form-input"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+1 234 567 890"
              />
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '20px' }}>{t('Bank Information')}</h3>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('Bank Name')}</label>
              <input
                type="text"
                name="bank_name"
                className="form-input"
                value={formData.bank_name}
                onChange={handleChange}
                placeholder={t('Bank name')}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('Bank Account (Tr. račun, used for the payment QR)')}</label>
              <input
                type="text"
                name="bank_account"
                className="form-input"
                value={formData.bank_account}
                onChange={handleChange}
                placeholder={t('Account number')}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('SWIFT Code')}</label>
              <input
                type="text"
                name="swift_code"
                className="form-input"
                value={formData.swift_code}
                onChange={handleChange}
                placeholder="SWIFT/BIC"
              />
            </div>
            <div className="form-group">
              <label className="form-label">IBAN</label>
              <input
                type="text"
                name="iban"
                className="form-input"
                value={formData.iban}
                onChange={handleChange}
                placeholder="IBAN"
              />
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '20px' }}>{t('Branding')}</h3>
          <div className="form-row">
            <ImageUpload field="logo" label={t('Logo')} preview={previews.logo} onChange={handleFileChange} onRemove={handleRemoveFile} />
            <div className="form-group">
              <label className="form-label">{t('Primary Color')}</label>
              <div className="color-picker">
                <input
                  type="color"
                  name="primary_color"
                  value={formData.primary_color}
                  onChange={handleChange}
                />
                <input
                  type="text"
                  name="primary_color"
                  className="form-input"
                  value={formData.primary_color}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('Secondary Color')}</label>
              <div className="color-picker">
                <input
                  type="color"
                  name="secondary_color"
                  value={formData.secondary_color}
                  onChange={handleChange}
                />
                <input
                  type="text"
                  name="secondary_color"
                  className="form-input"
                  value={formData.secondary_color}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="form-row">
            <ImageUpload field="stamp" label={t('Stamp (for invoices)')} preview={previews.stamp} onChange={handleFileChange} onRemove={handleRemoveFile} />
            <ImageUpload field="signature" label={t('Signature (for invoices)')} preview={previews.signature} onChange={handleFileChange} onRemove={handleRemoveFile} />
            <div className="form-group">
              <label className="form-label">{t('Signatory Name')}</label>
              <input
                type="text"
                name="signatory_name"
                className="form-input"
                value={formData.signatory_name}
                onChange={handleChange}
                placeholder={t('Name of person signing')}
              />
            </div>
          </div>
        </div>

        <TemplateDesign formData={formData} onChange={handleChange} templateId={id || fromId} />

        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '20px' }}>{t('Default Settings')}</h3>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('Default Currency')}</label>
              <select
                name="default_currency"
                className="form-select"
                value={formData.default_currency}
                onChange={handleChange}
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="BAM">BAM</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('Default VAT Rate (%)')}</label>
              <input
                type="number"
                name="default_vat_rate"
                className="form-input"
                value={formData.default_vat_rate}
                onChange={handleChange}
                min="0"
                max="100"
                step="0.01"
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('Default Place of Issue')}</label>
              <input
                type="text"
                name="default_place_of_issue"
                className="form-input"
                value={formData.default_place_of_issue}
                onChange={handleChange}
                placeholder={t('City name')}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('Invoice Number Prefix')}</label>
              <input
                type="text"
                name="invoice_prefix"
                className="form-input"
                value={formData.invoice_prefix}
                onChange={handleChange}
                placeholder="INV"
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('Receipt Number Prefix')}</label>
              <input
                type="text"
                name="receipt_prefix"
                className="form-input"
                value={formData.receipt_prefix}
                onChange={handleChange}
                placeholder="RCP"
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{t('VAT Note (English)')}</label>
            <textarea
              name="vat_note_en"
              className="form-textarea"
              value={formData.vat_note_en}
              onChange={handleChange}
              placeholder={t('Explanation for VAT exemption in English')}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('VAT Note (Local Language)')}</label>
            <textarea
              name="vat_note_local"
              className="form-textarea"
              value={formData.vat_note_local}
              onChange={handleChange}
              placeholder={t('Explanation for VAT exemption in local language')}
            />
            <p className="form-hint">{t('Invoices print the note in the language chosen in Settings.')}</p>
          </div>
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="is_default"
                checked={formData.is_default}
                onChange={handleChange}
              />
              {t('Set as default template')}
            </label>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/templates')}>
            {t('Cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? t('Saving...') : (isEditing ? t('Update Template') : t('Create Template'))}
          </button>
        </div>
      </form>
    </div>
  )
}

function Templates() {
  return (
    <Routes>
      <Route index element={<TemplateList />} />
      <Route path="new" element={<TemplateForm />} />
      <Route path=":id" element={<TemplateForm />} />
    </Routes>
  )
}

export default Templates
