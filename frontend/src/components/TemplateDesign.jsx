import { useState, useEffect, useRef } from 'react'
import { usePrefs, useT } from '../i18n'

const PAGE_WIDTH = 794 // A4 at 96 dpi, the viewport the preview HTML is laid out for

// Sandboxed render of preview HTML, scaled down to fit its container
function PagePreview({ html }) {
  const t = useT()
  const ref = useRef(null)
  const [scale, setScale] = useState(0)

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / PAGE_WIDTH))
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="page-preview">
      {html && <iframe title={t('Document preview')} sandbox="" srcDoc={html} style={{ transform: `scale(${scale})` }} />}
    </div>
  )
}

function ColorField({ name, label, value, onChange }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div className="color-picker">
        <input type="color" name={name} value={value} onChange={onChange} aria-label={label} />
        <input type="text" name={name} className="form-input" value={value} onChange={onChange} />
      </div>
    </div>
  )
}

// Layout, background and pattern settings with live previews rendered by the server
// Layout, pattern and placement names come from the API in English; t() translates them
function TemplateDesign({ formData, onChange, templateId }) {
  const { language, t } = usePrefs()
  const [options, setOptions] = useState(null)
  const [docType, setDocType] = useState('invoice')
  const [previews, setPreviews] = useState({})
  const setField = (name, value) => onChange({ target: { name, value } })

  useEffect(() => {
    fetch('/api/templates/design-options')
      .then(res => res.json())
      .then(setOptions)
      .catch(error => console.error('Error loading design options:', error))
  }, [])

  // Re-render every layout of the active document type after the form settles (and on language change)
  useEffect(() => {
    if (!options) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const entries = await Promise.all(options.layouts.map(async ({ id }) => {
          const res = await fetch('/api/templates/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              type: docType,
              template_id: templateId,
              template: { ...formData, [`${docType}_layout`]: id }
            })
          })
          return [id, res.ok ? await res.text() : '']
        }))
        setPreviews(Object.fromEntries(entries))
      } catch (error) {
        if (error.name !== 'AbortError') console.error('Error rendering preview:', error)
      }
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [options, docType, formData, templateId, language])

  const layoutField = `${docType}_layout`
  const selectedLayout = formData[layoutField] || 'classic'

  return (
    <div className="card">
      <h3 className="card-title" style={{ marginBottom: '20px' }}>{t('Design')}</h3>
      <div className="tabs">
        {['invoice', 'receipt'].map(type => (
          <button
            key={type}
            type="button"
            className={`tab ${docType === type ? 'active' : ''}`}
            onClick={() => setDocType(type)}
          >
            {type === 'invoice' ? t('Invoice') : t('Receipt')}
          </button>
        ))}
      </div>

      <div className="design-grid">
        <div>
          <label className="form-label">{docType === 'invoice' ? t('Invoice layout') : t('Receipt layout')}</label>
          <div className="layout-options">
            {options?.layouts.map(layout => (
              <button
                key={layout.id}
                type="button"
                className={`layout-option ${selectedLayout === layout.id ? 'selected' : ''}`}
                aria-pressed={selectedLayout === layout.id}
                title={t(layout.description)}
                onClick={() => setField(layoutField, layout.id)}
              >
                <PagePreview html={previews[layout.id]} />
                <span>{t(layout.label)}</span>
              </button>
            ))}
          </div>

          <div className="form-row">
            <ColorField name="background_color" label={t('Background color')} value={formData.background_color} onChange={onChange} />
            <ColorField name="pattern_color" label={t('Pattern (accent) color')} value={formData.pattern_color} onChange={onChange} />
          </div>

          <label className="form-label">{t('Pattern')}</label>
          <div className="pattern-options">
            {options?.patterns.map(pattern => (
              <button
                key={pattern.id}
                type="button"
                className={`pattern-option ${formData.pattern === pattern.id ? 'selected' : ''}`}
                aria-pressed={formData.pattern === pattern.id}
                aria-label={t(pattern.label)}
                title={t(pattern.label)}
                style={{ background: formData.background_color, color: formData.pattern_color }}
                onClick={() => setField('pattern', pattern.id)}
              >
                {/* svg comes from our own pattern library (design-options), never from user input */}
                {pattern.svg ? <span dangerouslySetInnerHTML={{ __html: pattern.svg }} /> : t('None')}
              </button>
            ))}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('Pattern placement')}</label>
              <select
                name="pattern_placement"
                className="form-select"
                value={formData.pattern_placement}
                onChange={onChange}
                disabled={formData.pattern === 'none'}
              >
                {options?.placements.map(p => <option key={p.id} value={p.id}>{t(p.label)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('Pattern intensity ({percent}%)', { percent: Math.round(formData.pattern_opacity * 100) })}</label>
              <input
                type="range"
                name="pattern_opacity"
                className="range-input"
                min="0.1"
                max="1"
                step="0.05"
                value={formData.pattern_opacity}
                onChange={onChange}
                disabled={formData.pattern === 'none'}
              />
            </div>
          </div>
          <p className="form-hint">
            {t('Bands, titles and totals use the Primary Color from Branding. Text switches to light on dark backgrounds. Logo, stamp and signature changes show in the preview after saving.')}
          </p>
        </div>

        <div className="design-preview">
          <PagePreview html={previews[selectedLayout]} />
        </div>
      </div>
    </div>
  )
}

export default TemplateDesign
