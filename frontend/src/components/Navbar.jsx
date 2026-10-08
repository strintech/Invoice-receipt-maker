import { usePrefs } from '../i18n'

const LANGUAGES = { en: 'English', bs: 'Bosanski' }

const THEME_ICONS = {
  light: 'M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z',
  dark: 'M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z',
  system: 'M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25'
}

function Segmented({ label, value, options, onChange }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          title={option.title}
          onClick={() => option.value !== value && onChange(option.value)}
        >
          {option.content}
        </button>
      ))}
    </div>
  )
}

// full = with names (Settings page); compact = codes/icons only (navbar)
export function LanguagePicker({ full }) {
  const { language, setPrefs, t } = usePrefs()
  return (
    <Segmented
      label={t('Language')}
      value={language}
      onChange={language => setPrefs({ language })}
      options={Object.entries(LANGUAGES).map(([value, name]) => ({ value, title: name, content: full ? name : value.toUpperCase() }))}
    />
  )
}

export function ThemePicker({ full }) {
  const { theme, setPrefs, t } = usePrefs()
  const names = { light: t('Light'), dark: t('Dark'), system: t('System') }
  return (
    <Segmented
      label={t('Theme')}
      value={theme}
      onChange={theme => setPrefs({ theme })}
      options={Object.entries(names).map(([value, name]) => ({
        value,
        title: name,
        content: (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d={THEME_ICONS[value]} />
            </svg>
            {full && name}
          </>
        )
      }))}
    />
  )
}

function Navbar({ className = '' }) {
  return (
    <div className={`navbar ${className}`}>
      <LanguagePicker />
      <ThemePicker />
    </div>
  )
}

export default Navbar
