import { useRef } from 'react'

const SLOTS = [
  {
    key: 'scorecard',
    required: true,
    label: 'DSP Scorecard PDF',
    sub: 'Powers analytics dashboard',
    accept: '.pdf',
    multiple: false,
  },
  {
    key: 'overview',
    required: true,
    label: 'Overview dashboard',
    sub: null,
    accept: '.csv',
    multiple: false,
  },
  {
    key: 'concessions',
    required: true,
    label: 'Delivery concessions',
    sub: null,
    accept: '.csv',
    multiple: false,
  },
  {
    key: 'safety',
    required: true,
    label: 'Safety dashboard',
    sub: null,
    accept: '.csv',
    multiple: false,
  },
  {
    key: 'cdf',
    required: true,
    label: 'Quality CDF',
    sub: null,
    accept: '.csv',
    multiple: false,
  },
  {
    key: 'feedback',
    required: false,
    label: 'Customer feedback files',
    sub: 'Up to 20 files',
    accept: '.csv',
    multiple: true,
  },
]

export default function UploadPanel({ loaded, statuses, onFile, onAnalyze, ready, week, savedWeeks, onWeekChange, saving }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {/* Upload cards grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))',
        gap: '8px',
        marginBottom: '10px',
      }}>
        {SLOTS.map(slot => (
          <UploadCard
            key={slot.key}
            slot={slot}
            loaded={loaded[slot.key]}
            status={statuses[slot.key]}
            onFile={onFile}
          />
        ))}
      </div>

      {/* Continue bar or Analyze button */}
      {!ready ? (
        <div style={{
          background: '#e8e6e0',
          color: 'var(--color-text-tertiary)',
          textAlign: 'center',
          padding: '10px',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: '500',
          marginBottom: '1rem',
        }}>
          Upload 5 required files to continue
        </div>
      ) : (
        <div
          onClick={onAnalyze}
          style={{
            background: '#e8f5e8', color: '#358118',
            textAlign: 'center', padding: '10px', borderRadius: '6px',
            fontSize: '13px', fontWeight: '500', marginBottom: '1rem',
            border: '0.5px solid #b8ddb8', cursor: 'pointer',
          }}
        >
          ✓ All files loaded — click to generate coaching report
        </div>
      )}

      {/* Saved weeks row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        background: 'var(--color-surface)',
        border: '0.5px solid var(--color-border)',
        borderRadius: '6px',
        fontSize: '12px',
        color: 'var(--color-text-secondary)',
      }}>
        <i className="ti ti-clock" style={{ fontSize: '13px' }} />
        <span>Saved weeks:</span>
        {savedWeeks && savedWeeks.length > 0 ? (
          <select
            onChange={e => onWeekChange && onWeekChange(e.target.value)}
            style={{
              border: '0.5px solid var(--color-border)',
              borderRadius: '4px',
              padding: '2px 6px',
              fontSize: '12px',
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
            }}
          >
            <option value="">— select a week —</option>
            {savedWeeks.map(w => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        ) : (
          <span style={{ color: 'var(--color-text-tertiary)' }}>No saved weeks yet</span>
        )}
        {saving && <span style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>Saving...</span>}
      </div>
    </div>
  )
}

function UploadCard({ slot, loaded, status, onFile }) {
  const ref = useRef()

  function handleChange(e) {
    if (e.target.files && e.target.files.length > 0) {
      onFile(slot.key, Array.from(e.target.files))
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFile(slot.key, Array.from(e.dataTransfer.files))
    }
  }

  return (
    <div
      onClick={() => ref.current?.click()}
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
      style={{
        background: loaded ? '#f0faf0' : 'var(--color-surface)',
        border: `0.5px solid ${loaded ? '#b8ddb8' : 'var(--color-border)'}`,
        borderRadius: '6px',
        padding: '12px',
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
        minHeight: '88px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
      onMouseEnter={e => { if (!loaded) e.currentTarget.style.borderColor = '#aaa' }}
      onMouseLeave={e => { if (!loaded) e.currentTarget.style.borderColor = 'var(--color-border)' }}
    >
      <input
        ref={ref}
        type="file"
        accept={slot.accept}
        multiple={slot.multiple}
        style={{ display: 'none' }}
        onChange={handleChange}
      />

      <div>
        <div style={{
          fontSize: '9px',
          fontWeight: '600',
          letterSpacing: '0.08em',
          color: slot.required ? 'var(--tier-poor)' : 'var(--color-text-tertiary)',
          textTransform: 'uppercase',
          marginBottom: '4px',
          fontFamily: 'var(--font-mono)',
        }}>
          {slot.required ? 'REQUIRED' : 'OPTIONAL'}
        </div>
        <div style={{
          fontSize: '13px',
          fontWeight: '500',
          color: 'var(--color-text-primary)',
          lineHeight: '1.3',
        }}>
          {slot.label}
        </div>
        {slot.sub && (
          <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
            {slot.sub}
          </div>
        )}
      </div>

      {loaded && status && (
        <div style={{
          fontSize: '10px',
          color: 'var(--tier-great)',
          marginTop: '6px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: 'var(--font-mono)',
        }}>
          ✓ {status}
        </div>
      )}
    </div>
  )
}
