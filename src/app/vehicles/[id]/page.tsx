'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Vehicle = {
  id: number
  license_plate: string | null
  brand: string | null
  model: string | null
  mileage: number | null
  next_service_km: number | null
  parking_location: string | null
  status: string | null
  bodywork_status: string | null
  notes: string | null
}

type Inspection = {
  id: number
  created_at: string | null
  inspection_date: string | null
  inspected_by: string | null
  mileage_at_inspection: number | null
  tire_condition: string | null
  brake_condition: string | null
  warning_lights: boolean | null
  bodywork_status: string | null
  bodywork_note: string | null
  car_clean: boolean | null
  ready_for_lld: boolean | null
  comment: string | null
}

type TriageState = 'ok' | 'warn' | 'bad'
type VehicleStatusKey = 'dispo' | 'contrat' | 'carro' | 'entretien' | 'indispo'

type ExtraVehicleData = {
  yearText: string
  colorText: string
  fuelText: string
  contractLabel: string
  contractEnd: string
}

const statusConfig: Record<
  VehicleStatusKey,
  {
    label: string
    color: string
    badgeClass: string
  }
> = {
  dispo: {
    label: 'Disponible',
    color: '#4dbb7a',
    badgeClass: 'bg-[#0d2e1e] text-[#4dbb7a]',
  },
  contrat: {
    label: 'En contrat LLD',
    color: '#5aadff',
    badgeClass: 'bg-[#0c2d4a] text-[#5aadff]',
  },
  carro: {
    label: 'Carrosserie',
    color: '#ffaa33',
    badgeClass: 'bg-[#2e1e00] text-[#ffaa33]',
  },
  entretien: {
    label: 'Entretien',
    color: '#ff6b6b',
    badgeClass: 'bg-[#3a0f0f] text-[#ff6b6b]',
  },
  indispo: {
    label: 'Indisponible',
    color: '#888',
    badgeClass: 'bg-[#222] text-[#888]',
  },
}

function formatKm(value: number | null) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('fr-FR').format(value)
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('fr-FR')
}

function formatTime(value: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getRemainingKm(mileage: number | null, nextService: number | null) {
  if (mileage === null || mileage === undefined) return null
  if (nextService === null || nextService === undefined) return null
  return nextService - mileage
}

function getKmPercent(mileage: number | null, nextService: number | null) {
  if (!mileage || !nextService || nextService <= 0) return 0
  return Math.min((mileage / nextService) * 100, 100)
}

function getKmColor(mileage: number | null, nextService: number | null) {
  if (!mileage || !nextService) return '#4dbb7a'
  const remaining = nextService - mileage
  if (remaining <= 3000) return '#ff6b6b'
  if (remaining <= 7000) return '#ffaa33'
  return '#4dbb7a'
}

function historyDotClassFromTriage(value: string | null) {
  const v = (value || '').toLowerCase()
  if (v.includes('bon') || v === 'ok') return 'bg-[#4dbb7a]'
  if (
    v.includes('moyen') ||
    v.includes('prévoir') ||
    v.includes('planif') ||
    v.includes('vérifier')
  )
    return 'bg-[#ffaa33]'
  return 'bg-[#ff6b6b]'
}

function getTriageButtonClass(active: boolean, value: TriageState) {
  if (!active) return 'border-[#2a2a2a] bg-[#111] text-[#555]'
  if (value === 'ok') return 'border-[#1a5a35] bg-[#0d2e1e] text-[#4dbb7a]'
  if (value === 'warn') return 'border-[#5a3a00] bg-[#2e1e00] text-[#ffaa33]'
  return 'border-[#6a1f1f] bg-[#3a0f0f] text-[#ff6b6b]'
}

function triageLabel(value: TriageState) {
  if (value === 'ok') return 'OK'
  if (value === 'warn') return '⚠'
  return '✕'
}

function InlineEditable({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'number' | 'date'
}) {
  const [editing, setEditing] = useState(false)

  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-[0.06em] text-[#555]">
        {label}
      </div>

      {editing ? (
        <input
          value={value}
          type={type}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setEditing(false)
          }}
          autoFocus
          className="w-full rounded-md border border-[#2a2a2a] bg-[#111] px-2 py-1 text-[13px] font-medium text-[#e0e0e0] outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-left text-[13px] font-medium text-[#e0e0e0] underline-offset-4 hover:underline"
        >
          {value || '—'}
        </button>
      )}
    </div>
  )
}

export default function VehiclePage() {
  const params = useParams<{ id: string }>()
  const id = params?.id

  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [historySearch, setHistorySearch] = useState('')

  const [currentStatus, setCurrentStatus] = useState<VehicleStatusKey>('dispo')

  const [brandText, setBrandText] = useState('')
  const [modelText, setModelText] = useState('')
  const [yearText, setYearText] = useState('2021')
  const [colorText, setColorText] = useState('Gris Platine')
  const [fuelText, setFuelText] = useState('Diesel')
  const [parkingLocation, setParkingLocation] = useState('')
  const [currentMileageText, setCurrentMileageText] = useState('')
  const [nextServiceText, setNextServiceText] = useState('')
  const [contractLabel, setContractLabel] = useState('LLD — Société Dupont')
  const [contractEnd, setContractEnd] = useState('31/08/2025')

  const [inspectedBy, setInspectedBy] = useState('')
  const [mileageInput, setMileageInput] = useState('')
  const [pneusState, setPneusState] = useState<TriageState>('ok')
  const [freinsState, setFreinsState] = useState<TriageState>('ok')
  const [voyantsState, setVoyantsState] = useState<TriageState>('ok')
  const [maintenanceState, setMaintenanceState] = useState<TriageState>('warn')
  const [carrosserieState, setCarrosserieState] = useState<TriageState>('warn')
  const [warningNote, setWarningNote] = useState('')
  const [carClean, setCarClean] = useState(true)
  const [readyLongTerm, setReadyLongTerm] = useState(false)
  const [readyForSale, setReadyForSale] = useState(false)
  const [sinistre, setSinistre] = useState(false)
  const [sinistreDescription, setSinistreDescription] = useState('')
  const [comment, setComment] = useState('')
  const [extraNotes, setExtraNotes] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const extraStorageKey = vehicle ? `vehicle-extra-${vehicle.id}` : null

  async function loadAll(numericId: number) {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', numericId)
      .single()

    if (error || !data) {
      setError(error?.message || 'Véhicule introuvable')
      setLoading(false)
      return
    }

    const v = data as Vehicle
    setVehicle(v)
    setBrandText(v.brand || '')
    setModelText(v.model || '')
    setParkingLocation(v.parking_location || '')
    setCurrentMileageText(v.mileage ? String(v.mileage) : '')
    setNextServiceText(v.next_service_km ? String(v.next_service_km) : '')

    const s = (v.status || '').toLowerCase()
    if (s.includes('contrat')) setCurrentStatus('contrat')
    else if (s.includes('carrosserie')) setCurrentStatus('carro')
    else if (s.includes('entretien')) setCurrentStatus('entretien')
    else if (s.includes('indispo')) setCurrentStatus('indispo')
    else setCurrentStatus('dispo')

    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(`vehicle-extra-${numericId}`)
      if (raw) {
        try {
          const extra = JSON.parse(raw) as ExtraVehicleData
          setYearText(extra.yearText || '2021')
          setColorText(extra.colorText || 'Gris Platine')
          setFuelText(extra.fuelText || 'Diesel')
          setContractLabel(extra.contractLabel || 'LLD — Société Dupont')
          setContractEnd(extra.contractEnd || '31/08/2025')
        } catch {
          setYearText('2021')
          setColorText('Gris Platine')
          setFuelText('Diesel')
          setContractLabel('LLD — Société Dupont')
          setContractEnd('31/08/2025')
        }
      } else {
        setYearText('2021')
        setColorText('Gris Platine')
        setFuelText('Diesel')
        setContractLabel('LLD — Société Dupont')
        setContractEnd('31/08/2025')
      }
    }

    const { data: inspectionsData } = await supabase
      .from('inspections')
      .select('*')
      .eq('vehicle_id', numericId)
      .order('created_at', { ascending: false })

    const list = (inspectionsData || []) as Inspection[]
    setInspections(list)

    if (list[0]) {
      const last = list[0]
      setInspectedBy(last.inspected_by || '')
      setMileageInput(
        last.mileage_at_inspection ? String(last.mileage_at_inspection) : ''
      )
      setPneusState(
        last.tire_condition === 'Bon'
          ? 'ok'
          : last.tire_condition === 'Moyen'
          ? 'warn'
          : 'bad'
      )
      setFreinsState(
        last.brake_condition === 'Bon'
          ? 'ok'
          : last.brake_condition === 'Moyen'
          ? 'warn'
          : 'bad'
      )
      setVoyantsState(last.warning_lights ? 'warn' : 'ok')
      setCarClean(last.car_clean ?? true)
      setReadyLongTerm(last.ready_for_lld ?? false)
    }

    setLoading(false)
  }

  useEffect(() => {
    async function run() {
      if (!id) {
        setError('ID manquant')
        setLoading(false)
        return
      }

      const numericId = Number(id)

      if (Number.isNaN(numericId)) {
        setError(`ID invalide : ${id}`)
        setLoading(false)
        return
      }

      await loadAll(numericId)
    }

    run()
  }, [id])

  const currentMileageNum = Number(currentMileageText || '0')
  const nextServiceNum = Number(nextServiceText || '0')

  const kmPercent = useMemo(
    () => getKmPercent(currentMileageNum || null, nextServiceNum || null),
    [currentMileageNum, nextServiceNum]
  )

  const kmColor = useMemo(
    () => getKmColor(currentMileageNum || null, nextServiceNum || null),
    [currentMileageNum, nextServiceNum]
  )

  const remainingKm = useMemo(
    () => getRemainingKm(currentMileageNum || null, nextServiceNum || null),
    [currentMileageNum, nextServiceNum]
  )

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase()
    if (!q) return inspections

    return inspections.filter((insp) => {
      const haystack = [
        insp.inspected_by || '',
        insp.comment || '',
        insp.bodywork_note || '',
        insp.tire_condition || '',
        insp.brake_condition || '',
        formatDate(insp.inspection_date || insp.created_at),
        formatTime(insp.created_at),
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(q)
    })
  }, [inspections, historySearch])

  const visibleHistory = showAllHistory
    ? filteredHistory
    : filteredHistory.slice(0, 3)

  async function handleSaveInspection() {
    if (!vehicle) return
    setSaveMessage(null)

    if (sinistre && !sinistreDescription.trim()) {
      setSaveMessage('Merci de décrire le sinistre.')
      return
    }

    setSaving(true)

    const mappedTire =
      pneusState === 'ok' ? 'Bon' : pneusState === 'warn' ? 'Moyen' : 'Mauvais'
    const mappedBrake =
      freinsState === 'ok' ? 'Bon' : freinsState === 'warn' ? 'Moyen' : 'Mauvais'
    const mappedVehicleStatus = statusConfig[currentStatus].label

    const mappedBodyworkStatus =
      carrosserieState === 'ok'
        ? 'ok'
        : carrosserieState === 'warn'
        ? 'a_verifier'
        : 'en_cours'

    const finalBodyworkNote = [
      voyantsState !== 'ok' && warningNote ? `Voyants: ${warningNote}` : null,
      sinistre && sinistreDescription ? `Sinistre: ${sinistreDescription}` : null,
    ]
      .filter(Boolean)
      .join(' | ')

    const finalComment = [
      comment ? `Commentaire: ${comment}` : null,
      extraNotes ? `Notes: ${extraNotes}` : null,
    ]
      .filter(Boolean)
      .join(' | ')

    const mergedVehicleNotes = [
      comment?.trim() ? `Commentaire: ${comment.trim()}` : null,
      extraNotes?.trim() ? `Notes: ${extraNotes.trim()}` : null,
      sinistreDescription?.trim()
        ? `Sinistre: ${sinistreDescription.trim()}`
        : null,
      warningNote?.trim() ? `Voyants: ${warningNote.trim()}` : null,
    ]
      .filter(Boolean)
      .join(' | ')

    const { error: inspectionError } = await supabase.from('inspections').insert({
      vehicle_id: vehicle.id,
      inspected_by: inspectedBy || null,
      mileage_at_inspection: mileageInput
        ? Number(mileageInput)
        : currentMileageNum || null,
      tire_condition: mappedTire,
      brake_condition: mappedBrake,
      warning_lights: voyantsState !== 'ok',
      bodywork_status: mappedBodyworkStatus,
      bodywork_note: finalBodyworkNote || null,
      car_clean: carClean,
      ready_for_lld: readyLongTerm,
      comment: finalComment || null,
    })

    if (inspectionError) {
      setSaveMessage(`Erreur : ${inspectionError.message}`)
      setSaving(false)
      return
    }

    const { error: vehicleError } = await supabase
      .from('vehicles')
      .update({
        brand: brandText || null,
        model: modelText || null,
        mileage: currentMileageText ? Number(currentMileageText) : null,
        next_service_km: nextServiceText ? Number(nextServiceText) : null,
        parking_location: parkingLocation || null,
        status: mappedVehicleStatus,
        bodywork_status: mappedBodyworkStatus,
        notes: mergedVehicleNotes || null,
      })
      .eq('id', vehicle.id)

    if (vehicleError) {
      setSaveMessage(
        `Inspection enregistrée, mais mise à jour véhicule impossible : ${vehicleError.message}`
      )
      setSaving(false)
      return
    }

    if (typeof window !== 'undefined' && extraStorageKey) {
      const extraData: ExtraVehicleData = {
        yearText,
        colorText,
        fuelText,
        contractLabel,
        contractEnd,
      }
      localStorage.setItem(extraStorageKey, JSON.stringify(extraData))
    }

    setSaveMessage('Inspection enregistrée avec succès.')
    setSaving(false)

    await loadAll(vehicle.id)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f0f0f] text-[#f0f0f0]">
        <div className="p-4">Chargement...</div>
      </main>
    )
  }

  if (error || !vehicle) {
    return (
      <main className="min-h-screen bg-[#0f0f0f] p-4 text-[#f0f0f0]">
        <Link
          href="/"
          className="inline-flex rounded-lg border border-[#2a2a2a] bg-[#222] px-3 py-2 text-sm text-[#888]"
        >
          ← Retour
        </Link>
        <h1 className="mt-6 text-4xl font-bold">Véhicule introuvable</h1>
        <p className="mt-4 text-[#777]">ID demandé : {id || '—'}</p>
        <p className="mt-2 text-[#ff6b6b]">Erreur : {error}</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0f0f0f] pb-10 text-[#f0f0f0]">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded-md border border-[#2a2a2a] bg-[#222] px-3 py-1.5 text-xs text-[#888]"
          >
            ← Retour
          </Link>
          <div>
            <div className="text-[15px] font-semibold">Nouvelle inspection</div>
            <div className="text-[11px] text-[#555]">Zen OP</div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveInspection}
          disabled={saving}
          className="rounded-lg bg-[#185FA5] px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          {saving ? '...' : 'Enregistrer'}
        </button>
      </div>

      <div className="mx-auto max-w-[980px]">
        <div className="mx-4 mt-4 overflow-hidden rounded-[14px] border border-[#2a2a2a] bg-[#1a1a1a]">
          <div className="flex items-center justify-between border-b border-[#2a2a2a] bg-[#111] px-4 py-3">
            <span className="rounded-md bg-[#222] px-3 py-1.5 font-mono text-base font-bold tracking-wider">
              {vehicle.license_plate}
            </span>

            <span
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${statusConfig[currentStatus].badgeClass}`}
            >
              {statusConfig[currentStatus].label}
            </span>
          </div>

          <div className="px-4 py-4">
            <div className="mb-3 grid grid-cols-2 gap-[11px]">
              <InlineEditable label="Marque" value={brandText} onChange={setBrandText} />
              <InlineEditable label="Modèle" value={modelText} onChange={setModelText} />
              <InlineEditable label="Année" value={yearText} onChange={setYearText} />
              <InlineEditable label="Couleur" value={colorText} onChange={setColorText} />
              <InlineEditable label="Carburant" value={fuelText} onChange={setFuelText} />
              <InlineEditable
                label="Emplacement"
                value={parkingLocation}
                onChange={setParkingLocation}
              />
            </div>

            <div className="my-[11px] h-px bg-[#2a2a2a]" />

            <div className="mb-3 grid grid-cols-3 gap-[10px]">
              <InlineEditable
                label="Km actuel"
                value={currentMileageText}
                onChange={setCurrentMileageText}
                type="number"
              />
              <InlineEditable
                label="Prochain entretien"
                value={nextServiceText}
                onChange={setNextServiceText}
                type="number"
              />
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-[0.06em] text-[#555]">
                  Reste
                </div>
                <div
                  className="text-[13px] font-medium"
                  style={{
                    color:
                      remainingKm !== null && remainingKm <= 3000
                        ? '#ff6b6b'
                        : '#e0e0e0',
                  }}
                >
                  {remainingKm !== null ? `${formatKm(remainingKm)} km` : '—'}
                </div>
              </div>
            </div>

            <div className="mb-1 flex justify-between text-[11px] text-[#555]">
              <span>{formatKm(currentMileageNum || null)} km</span>
              <span>
                Entretien à {formatKm(nextServiceNum || null)} km —{' '}
                {Math.round(kmPercent)}%
              </span>
            </div>

            <div className="mb-3 h-[6px] overflow-hidden rounded-full bg-[#2a2a2a]">
              <div
                className="h-full rounded-full"
                style={{ width: `${kmPercent}%`, background: kmColor }}
              />
            </div>

            <div className="mb-3 grid grid-cols-2 gap-[11px]">
              <InlineEditable
                label="Contrat"
                value={contractLabel}
                onChange={setContractLabel}
              />
              <InlineEditable
                label="Fin contrat"
                value={contractEnd}
                onChange={setContractEnd}
              />
            </div>
          </div>
        </div>

        <div className="mx-4 mt-[18px] mb-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-[#444]">
          Historique des inspections
        </div>

        <div className="mx-4 mb-2">
          <input
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            placeholder="Rechercher dans l'historique..."
            className="w-full rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3 text-[13px] text-[#e0e0e0] outline-none placeholder:text-[#555]"
          />
        </div>

        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          className="mx-4 flex w-[calc(100%-32px)] items-center justify-between rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-[13px] text-left"
        >
          <div>
            <div className="text-[13px] font-medium text-[#e0e0e0]">
              {filteredHistory.length} inspection
              {filteredHistory.length > 1 ? 's' : ''} trouvée
              {filteredHistory.length > 1 ? 's' : ''}
            </div>
            <div className="mt-[3px] text-[11px] text-[#555]">
              {filteredHistory[0]
                ? `Dernière : ${formatDate(
                    filteredHistory[0].inspection_date || filteredHistory[0].created_at
                  )} à ${formatTime(filteredHistory[0].created_at)} par ${
                    filteredHistory[0].inspected_by || '—'
                  }`
                : 'Aucune inspection enregistrée'}
            </div>
          </div>

          <span
            className={`text-[12px] text-[#444] transition ${
              historyOpen ? 'rotate-180' : ''
            }`}
          >
            ▼
          </span>
        </button>

        {historyOpen ? (
          <div className="mx-4 mt-2 overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#111]">
            {visibleHistory.length === 0 ? (
              <div className="px-4 py-4 text-sm text-[#666]">Aucun résultat.</div>
            ) : (
              visibleHistory.map((insp) => (
                <div
                  key={insp.id}
                  className="border-b border-[#1f1f1f] px-4 py-[14px] last:border-b-0"
                >
                  <div className="mb-[10px] flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-[#ccc]">
                      {formatDate(insp.inspection_date || insp.created_at)}
                    </span>
                    <span className="text-[11px] text-[#555]">
                      {insp.inspected_by || '—'} · {formatTime(insp.created_at)}
                      {insp.mileage_at_inspection
                        ? ` · ${formatKm(insp.mileage_at_inspection)} km`
                        : ''}
                    </span>
                  </div>

                  <div className="mb-2 grid grid-cols-2 gap-[6px] text-[12px] text-[#777]">
                    <div className="flex items-center gap-[6px]">
                      <div
                        className={`h-[7px] w-[7px] rounded-full ${historyDotClassFromTriage(
                          insp.tire_condition
                        )}`}
                      />
                      Pneus : {insp.tire_condition || '—'}
                    </div>
                    <div className="flex items-center gap-[6px]">
                      <div
                        className={`h-[7px] w-[7px] rounded-full ${historyDotClassFromTriage(
                          insp.brake_condition
                        )}`}
                      />
                      Freins : {insp.brake_condition || '—'}
                    </div>
                    <div className="flex items-center gap-[6px]">
                      <div
                        className={`h-[7px] w-[7px] rounded-full ${
                          insp.warning_lights ? 'bg-[#ff6b6b]' : 'bg-[#4dbb7a]'
                        }`}
                      />
                      Voyants : {insp.warning_lights ? 'Actifs' : 'Aucun'}
                    </div>
                    <div className="flex items-center gap-[6px]">
                      <div
                        className={`h-[7px] w-[7px] rounded-full ${
                          insp.bodywork_status === 'ok'
                            ? 'bg-[#4dbb7a]'
                            : 'bg-[#ffaa33]'
                        }`}
                      />
                      Carrosserie : {insp.bodywork_status || '—'}
                    </div>
                    <div className="flex items-center gap-[6px]">
                      <div
                        className={`h-[7px] w-[7px] rounded-full ${
                          insp.car_clean ? 'bg-[#4dbb7a]' : 'bg-[#ff6b6b]'
                        }`}
                      />
                      Propreté : {insp.car_clean ? 'propre' : 'sale'}
                    </div>
                    <div className="flex items-center gap-[6px]">
                      <div
                        className={`h-[7px] w-[7px] rounded-full ${
                          insp.ready_for_lld ? 'bg-[#4dbb7a]' : 'bg-[#ff6b6b]'
                        }`}
                      />
                      Prête LLD : {insp.ready_for_lld ? 'oui' : 'non'}
                    </div>
                  </div>

                  {insp.bodywork_note ? (
                    <div className="mt-[6px] rounded-lg bg-[#1a1a1a] px-[10px] py-2 text-[12px] italic text-[#555]">
                      {insp.bodywork_note}
                    </div>
                  ) : null}

                  {insp.comment ? (
                    <div className="mt-[6px] rounded-lg bg-[#1a1a1a] px-[10px] py-2 text-[12px] italic text-[#555]">
                      {insp.comment}
                    </div>
                  ) : null}
                </div>
              ))
            )}

            {filteredHistory.length > 3 ? (
              <div className="border-t border-[#1f1f1f] p-3">
                <button
                  type="button"
                  onClick={() => setShowAllHistory((v) => !v)}
                  className="w-full rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2 text-sm text-[#e0e0e0]"
                >
                  {showAllHistory
                    ? 'Voir seulement les 3 premières'
                    : `+ Voir les ${filteredHistory.length - 3} restantes`}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mx-4 mt-[18px] mb-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-[#444]">
          Statut du véhicule
        </div>

        <div className="mx-4 mb-2 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-[14px]">
          <div className="mb-[10px] flex items-center justify-between text-[12px] text-[#888]">
            <span>Statut actuel</span>
            <span
              className="min-w-[100px] text-right text-[12px] font-semibold"
              style={{ color: statusConfig[currentStatus].color }}
            >
              {statusConfig[currentStatus].label}
            </span>
          </div>

          <div className="flex gap-1">
            {(
              ['dispo', 'contrat', 'carro', 'entretien', 'indispo'] as VehicleStatusKey[]
            ).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setCurrentStatus(key)}
                className={`flex-1 rounded-lg border px-1 py-2 text-[11px] font-medium ${
                  currentStatus === key
                    ? statusConfig[key].badgeClass + ' border-transparent'
                    : 'border-[#2a2a2a] bg-[#111] text-[#555]'
                }`}
              >
                {key === 'contrat'
                  ? 'En contrat'
                  : key === 'carro'
                  ? 'Carrosserie'
                  : key === 'entretien'
                  ? 'Entretien'
                  : key === 'indispo'
                  ? 'Indisponible'
                  : 'Disponible'}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-4 mt-[18px] mb-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-[#444]">
          Nouvelle inspection
        </div>

        <div className="mx-4 mb-2 grid grid-cols-2 gap-2">
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-[0.06em] text-[#555]">
              Contrôlé par
            </div>
            <input
              value={inspectedBy}
              onChange={(e) => setInspectedBy(e.target.value)}
              className="w-full rounded-[10px] border border-[#2a2a2a] bg-[#1a1a1a] px-[13px] py-[10px] text-[13px] text-[#e0e0e0] outline-none"
              placeholder="Votre nom"
            />
          </div>

          <div>
            <div className="mb-1 text-[10px] uppercase tracking-[0.06em] text-[#555]">
              Km relevé
            </div>
            <input
              value={mileageInput}
              onChange={(e) => setMileageInput(e.target.value)}
              className="w-full rounded-[10px] border border-[#2a2a2a] bg-[#1a1a1a] px-[13px] py-[10px] text-[13px] text-[#e0e0e0] outline-none"
              placeholder="Ex: 68 500"
              type="number"
            />
          </div>
        </div>

        <div className="mx-4 mt-[18px] mb-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-[#444]">
          État mécanique
        </div>

        {[
          {
            label: 'Pneus',
            sub: 'État des 4 pneus',
            value: pneusState,
            setter: setPneusState,
          },
          {
            label: 'Freins',
            sub: 'Avant et arrière',
            value: freinsState,
            setter: setFreinsState,
          },
          {
            label: 'Voyants tableau de bord',
            sub: voyantsState === 'ok' ? 'Aucun voyant allumé' : 'Voyants à détailler',
            value: voyantsState,
            setter: setVoyantsState,
          },
          {
            label: 'Maintenance',
            sub: `Prochain entretien : ${formatKm(nextServiceNum || null)} km`,
            value: maintenanceState,
            setter: setMaintenanceState,
          },
        ].map((row) => (
          <div key={row.label}>
            <div
              className={`mx-4 mb-2 flex items-center justify-between rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-[14px] py-3 ${
                row.label === 'Voyants tableau de bord' && row.value !== 'ok'
                  ? 'rounded-b-none'
                  : ''
              }`}
            >
              <div>
                <div className="text-[14px] text-[#e0e0e0]">{row.label}</div>
                <div className="mt-0.5 text-[11px] text-[#555]">{row.sub}</div>
              </div>

              <div className="flex gap-[5px]">
                {(['ok', 'warn', 'bad'] as TriageState[]).map((state) => (
                  <button
                    key={state}
                    type="button"
                    onClick={() => row.setter(state)}
                    className={`rounded-full border px-[13px] py-[6px] text-[12px] font-medium ${getTriageButtonClass(
                      row.value === state,
                      state
                    )}`}
                  >
                    {triageLabel(state)}
                  </button>
                ))}
              </div>
            </div>

            {row.label === 'Voyants tableau de bord' && row.value !== 'ok' ? (
              <div className="mx-4 -mt-2 mb-2 rounded-b-xl border border-t-0 border-[#4a3000] bg-[#1f1a0a] px-[14px] py-[10px]">
                <div className="mb-[6px] text-[10px] font-semibold uppercase tracking-[0.06em] text-[#ffaa33]">
                  Décrivez le(s) voyant(s)
                </div>
                <textarea
                  value={warningNote}
                  onChange={(e) => setWarningNote(e.target.value)}
                  className="h-[70px] w-full resize-none rounded-lg border border-[#4a3000] bg-[#111] px-[10px] py-2 text-[12px] text-[#e0e0e0] outline-none"
                  placeholder="Ex: voyant moteur allumé..."
                />
              </div>
            ) : null}
          </div>
        ))}

        <div className="mx-4 mt-[18px] mb-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-[#444]">
          Carrosserie & état général
        </div>

        <div className="mx-4 mb-2 flex items-center justify-between rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-[14px] py-3">
          <div>
            <div className="text-[14px] text-[#e0e0e0]">Carrosserie</div>
            <div className="mt-0.5 text-[11px] text-[#555]">
              Rayures, bosses, dommages visibles
            </div>
          </div>

          <div className="flex gap-[5px]">
            {(['ok', 'warn', 'bad'] as TriageState[]).map((state) => (
              <button
                key={state}
                type="button"
                onClick={() => setCarrosserieState(state)}
                className={`rounded-full border px-[13px] py-[6px] text-[12px] font-medium ${getTriageButtonClass(
                  carrosserieState === state,
                  state
                )}`}
              >
                {triageLabel(state)}
              </button>
            ))}
          </div>
        </div>

        {[
          {
            label: 'Voiture propre',
            sub: 'Intérieur et extérieur',
            checked: carClean,
            setChecked: setCarClean,
          },
          {
            label: 'Prête pour LLD',
            sub: 'Disponible pour contrat longue durée',
            checked: readyLongTerm,
            setChecked: setReadyLongTerm,
          },
          {
            label: 'Prête à vendre',
            sub: 'En état de vente',
            checked: readyForSale,
            setChecked: setReadyForSale,
          },
          {
            label: 'Nouveau sinistre',
            sub: 'Accident ou dommage à déclarer',
            checked: sinistre,
            setChecked: setSinistre,
          },
        ].map((row) => (
          <label
            key={row.label}
            className={`mx-4 mb-2 flex cursor-pointer items-center gap-3 rounded-xl border px-[14px] py-3 ${
              row.checked
                ? 'border-[#185FA5] bg-[#0a1f35]'
                : 'border-[#2a2a2a] bg-[#1a1a1a]'
            }`}
          >
            <input
              type="checkbox"
              checked={row.checked}
              onChange={(e) => row.setChecked(e.target.checked)}
              className="h-[18px] w-[18px] shrink-0 accent-[#185FA5]"
            />
            <div>
              <div
                className={`text-[14px] ${
                  row.checked ? 'text-[#5aadff]' : 'text-[#e0e0e0]'
                }`}
              >
                {row.label}
              </div>
              <div className="mt-0.5 text-[11px] text-[#555]">{row.sub}</div>
            </div>
          </label>
        ))}

        {sinistre ? (
          <div className="mx-4 mb-2 rounded-xl border border-[#5a1f1f] bg-[#1f0a0a] px-[14px] py-[14px]">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#ff6b6b]">
              Description du sinistre
            </div>
            <textarea
              value={sinistreDescription}
              onChange={(e) => setSinistreDescription(e.target.value)}
              className="h-[90px] w-full resize-none rounded-[10px] border border-[#2a2a2a] bg-[#1a1a1a] px-[14px] py-3 text-[13px] text-[#e0e0e0] outline-none"
              placeholder="Emplacement du dommage, circonstances, gravité..."
            />
          </div>
        ) : null}

        <div className="mx-4 mt-[18px] mb-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-[#444]">
          Commentaire général
        </div>

        <div className="mx-4 mb-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="h-[90px] w-full resize-none rounded-[10px] border border-[#2a2a2a] bg-[#1a1a1a] px-[14px] py-3 text-[13px] text-[#e0e0e0] outline-none"
            placeholder="Remarques, observations, points d'attention pour l'équipe..."
          />
        </div>

        <div className="mx-4 mt-[18px] mb-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-[#444]">
          Notes
        </div>

        <div className="mx-4 mb-2">
          <textarea
            value={extraNotes}
            onChange={(e) => setExtraNotes(e.target.value)}
            className="h-[90px] w-full resize-none rounded-[10px] border border-[#2a2a2a] bg-[#1a1a1a] px-[14px] py-3 text-[13px] text-[#e0e0e0] outline-none"
            placeholder="Ajouter des notes internes..."
          />
        </div>

        <div className="px-4 pt-4">
          <button
            type="button"
            onClick={handleSaveInspection}
            disabled={saving}
            className="w-full rounded-xl bg-[#185FA5] px-4 py-4 text-base font-bold text-white disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : "Enregistrer l'inspection"}
          </button>

          {saveMessage ? (
            <p className="mt-3 text-sm text-[#bdbdbd]">{saveMessage}</p>
          ) : null}
        </div>
      </div>
    </main>
  )
}