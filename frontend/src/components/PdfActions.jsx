import { useState, useRef, useEffect } from 'react'
import { useT } from '../i18n'

// Print / download a document PDF; "Black & white" asks the server for the ink-saver version
function PdfActions({ url, filename }) {
  const t = useT()
  const [bw, setBw] = useState(false)
  const [busy, setBusy] = useState(false)
  const frameRef = useRef(null)

  const removeFrame = () => {
    if (!frameRef.current) return
    URL.revokeObjectURL(frameRef.current.src)
    frameRef.current.remove()
    frameRef.current = null
  }
  useEffect(() => removeFrame, [])

  const fetchPdf = async () => {
    const res = await fetch(bw ? `${url}?bw=1` : url)
    if (!res.ok) throw new Error('Failed to generate PDF')
    return URL.createObjectURL(await res.blob())
  }

  const run = (action) => async () => {
    setBusy(true)
    try {
      await action()
    } catch (error) {
      console.error('PDF error:', error)
    } finally {
      setBusy(false)
    }
  }

  const download = run(async () => {
    const href = await fetchPdf()
    const a = document.createElement('a')
    a.href = href
    a.download = `${filename}${bw ? '-bw' : ''}.pdf`
    a.click()
    URL.revokeObjectURL(href)
  })

  // A hidden iframe opens the print dialog on the PDF itself; kept until the next print or unmount
  const print = run(async () => {
    removeFrame()
    const frame = document.createElement('iframe')
    frame.style.cssText = 'position: fixed; width: 0; height: 0; border: 0; visibility: hidden;'
    frame.onload = () => {
      try {
        frame.contentWindow.print()
      } catch {
        window.open(frame.src)
      }
    }
    frame.src = await fetchPdf()
    document.body.appendChild(frame)
    frameRef.current = frame
  })

  return (
    <div className="pdf-actions">
      <label className="checkbox-label">
        <input type="checkbox" checked={bw} onChange={(e) => setBw(e.target.checked)} />
        {t('Black & white')}
      </label>
      <button type="button" className="btn btn-secondary" onClick={print} disabled={busy}>{t('Print')}</button>
      <button type="button" className="btn btn-secondary" onClick={download} disabled={busy}>
        {busy ? t('Generating…') : t('Download PDF')}
      </button>
    </div>
  )
}

export default PdfActions
