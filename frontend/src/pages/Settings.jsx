import { LanguagePicker, ThemePicker } from '../components/Navbar'
import { useT } from '../i18n'

function Settings() {
  const t = useT()

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('Settings')}</h1>
      </div>

      <div className="card settings-card">
        <div className="form-group">
          <div className="form-label">{t('Language')}</div>
          <LanguagePicker full />
          <p className="form-hint">{t('Used for the app and for generated invoices and receipts.')}</p>
        </div>
        <div className="form-group">
          <div className="form-label">{t('Theme')}</div>
          <ThemePicker full />
          <p className="form-hint">{t('System follows your operating system setting.')}</p>
        </div>
      </div>
    </div>
  )
}

export default Settings
