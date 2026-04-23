'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Vehicle = {
  id: number
  license_plate: string
  brand: string | null
  model: string | null
  mileage: number | null
  next_service_km: number | null
  parking_location: string | null
  status: string | null
  bodywork_status: string | null
  notes: string | null
  is_archived?: boolean | null
  archived_at?: string | null
  archive_reason?: string | null
}

type Props = { vehicles: Vehicle[] }

type VehicleForm = {
  license_plate: string
  brand: string
  model: string
  mileage: string
  next_service_km: string
  parking_location: string
  status: string
  bodywork_status: string
  notes: string
}

const emptyForm: VehicleForm = {
  license_plate: '',
  brand: '',
  model: '',
  mileage: '',
  next_service_km: '',
  parking_location: '',
  status: 'Disponible',
  bodywork_status: 'ok',
  notes: '',
}

function formatKm(value: number | null) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('fr-FR').format(value)
}

function getStatusBadge(status: string | null) {
  const s = (status || '').toLowerCase()
  if (s.includes('disponible')) return 'bg-[#E8F1D9] text-[#3D5A1D]'
  if (s.includes('contrat')) return 'bg-[#DCE9F9] text-[#245B9B]'
  if (s.includes('carrosserie')) return 'bg-[#F2E6D3] text-[#8B5A1A]'
  if (s.includes('entretien')) return 'bg-[#3a0f0f] text-[#ff6b6b]'
  if (s.includes('indispo')) return 'bg-zinc-700 text-zinc-200'
  return 'bg-zinc-700 text-zinc-100'
}

function getBodyworkLabel(value: string | null) {
  const v = (value || '').toLowerCase()
  if (v === 'ok') return 'OK'
  if (v === 'a_verifier') return 'À vérifier'
  if (v === 'en_cours') return 'En réparation'
  if (v === 'urgent') return 'Urgent'
  return value || '—'
}

function getBodyworkColor(value: string | null) {
  const v = (value || '').toLowerCase()
  if (v === 'ok') return 'text-emerald-400'
  if (v === 'a_verifier') return 'text-amber-400'
  if (v === 'en_cours' || v === 'urgent') return 'text-red-400'
  return 'text-zinc-300'
}

function getProgressColor(vehicle: Vehicle) {
  const status = (vehicle.status || '').toLowerCase()
  const mileage = vehicle.mileage || 0
  const nextService = vehicle.next_service_km || 0
  if (status.includes('carrosserie')) return 'bg-[#19C08A]'
  if (nextService > 0 && mileage >= nextService - 3000) return 'bg-[#F55252]'
  return 'bg-[#F2AE2E]'
}

function getProgressPercent(vehicle: Vehicle) {
  const mileage = vehicle.mileage || 0
  const nextService = vehicle.next_service_km || 0
  if (!nextService || nextService <= 0) return 35
  return Math.max(Math.min((mileage / nextService) * 100, 100), 10)
}

function daysLeftFromArchive(archivedAt: string | null | undefined) {
  if (!archivedAt) return 30
  const diff = Date.now() - new Date(archivedAt).getTime()
  return Math.max(0, 30 - Math.floor(diff / (1000 * 60 * 60 * 24)))
}

function countAvailable(vehicles: Vehicle[]) {
  return vehicles.filter(
    (v) =>
      !(v.is_archived ?? false) &&
      (v.status || '').toLowerCase().includes('disponible')
  ).length
}

function countContract(vehicles: Vehicle[]) {
  return vehicles.filter(
    (v) =>
      !(v.is_archived ?? false) &&
      (v.status || '').toLowerCase().includes('contrat')
  ).length
}

function countBodywork(vehicles: Vehicle[]) {
  return vehicles.filter(
    (v) =>
      !(v.is_archived ?? false) &&
      (v.status || '').toLowerCase().includes('carrosserie')
  ).length
}

function countMaintenance(vehicles: Vehicle[]) {
  return vehicles.filter((v) => {
    if (v.is_archived ?? false) return false
    const mileage = v.mileage || 0
    const nextService = v.next_service_km || 0
    return !!nextService && mileage >= nextService - 3000
  }).length
}

function toForm(vehicle: Vehicle): VehicleForm {
  return {
    license_plate: vehicle.license_plate || '',
    brand: vehicle.brand || '',
    model: vehicle.model || '',
    mileage: vehicle.mileage?.toString() || '',
    next_service_km: vehicle.next_service_km?.toString() || '',
    parking_location: vehicle.parking_location || '',
    status: vehicle.status || 'Disponible',
    bodywork_status: vehicle.bodywork_status || 'ok',
    notes: vehicle.notes || '',
  }
}

export default function VehicleDashboard({ vehicles }: Props) {
  const router = useRouter()

  const [vehicleList, setVehicleList] = useState<Vehicle[]>(vehicles)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'cards' | 'list' | 'parking'>('cards')

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showDeletedPanel, setShowDeletedPanel] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)

  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [addForm, setAddForm] = useState<VehicleForm>(emptyForm)
  const [editForm, setEditForm] = useState<VehicleForm>(emptyForm)

  const [savingAdd, setSavingAdd] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [restoringId, setRestoringId] = useState<number | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const [selectedParking, setSelectedParking] = useState<string | null>(null)

  const activeVehicles = useMemo(
    () => vehicleList.filter((v) => !(v.is_archived ?? false)),
    [vehicleList]
  )

  const archivedVehicles = useMemo(
    () =>
      vehicleList
        .filter((v) => v.is_archived ?? false)
        .sort((a, b) => {
          const aTime = a.archived_at ? new Date(a.archived_at).getTime() : 0
          const bTime = b.archived_at ? new Date(b.archived_at).getTime() : 0
          return bTime - aTime
        }),
    [vehicleList]
  )

  const filteredVehicles = useMemo(() => {
    const q = search.trim().toLowerCase()

    return activeVehicles.filter((vehicle) => {
      const searchableText = [
        vehicle.license_plate || '',
        vehicle.parking_location || '',
        vehicle.brand || '',
        vehicle.model || '',
        vehicle.status || '',
        vehicle.bodywork_status || '',
        vehicle.notes || '',
      ]
        .join(' ')
        .toLowerCase()

      const matchesSearch = !q || searchableText.includes(q)

      let matchesFilter = true
      if (filter === 'dispo') {
        matchesFilter = (vehicle.status || '')
          .toLowerCase()
          .includes('disponible')
      }
      if (filter === 'contrat') {
        matchesFilter = (vehicle.status || '').toLowerCase().includes('contrat')
      }
      if (filter === 'carro') {
        matchesFilter = (vehicle.status || '')
          .toLowerCase()
          .includes('carrosserie')
      }
      if (filter === 'entretien') {
        const mileage = vehicle.mileage || 0
        const nextService = vehicle.next_service_km || 0
        matchesFilter = nextService > 0 && mileage >= nextService - 3000
      }

      return matchesSearch && matchesFilter
    })
  }, [activeVehicles, search, filter])

  const parkingGroups = useMemo(() => {
    const groups = new Map<string, Vehicle[]>()

    for (const vehicle of activeVehicles) {
      const parking = (vehicle.parking_location || '').trim() || 'Sans parking'
      if (!groups.has(parking)) groups.set(parking, [])
      groups.get(parking)!.push(vehicle)
    }

    return Array.from(groups.entries())
      .map(([parking, items]) => ({
        parking,
        vehicles: items.sort((a, b) =>
          (a.license_plate || '').localeCompare(b.license_plate || '')
        ),
      }))
      .sort((a, b) => a.parking.localeCompare(b.parking))
  }, [activeVehicles])

  const selectedParkingVehicles = useMemo(() => {
    if (!selectedParking) return []
    const group = parkingGroups.find((g) => g.parking === selectedParking)
    return group ? group.vehicles : []
  }, [parkingGroups, selectedParking])

  const updateAddForm = (key: keyof VehicleForm, value: string) =>
    setAddForm((prev) => ({ ...prev, [key]: value }))

  const updateEditForm = (key: keyof VehicleForm, value: string) =>
    setEditForm((prev) => ({ ...prev, [key]: value }))

  function openManage(vehicle: Vehicle) {
    setSelectedVehicle(vehicle)
    setEditForm(toForm(vehicle))
    setActionMessage(null)
    setManageOpen(true)
  }

  function openAddModal() {
    setSidebarOpen(false)
    setShowDeletedPanel(false)
    setActionMessage(null)
    setAddForm(emptyForm)
    setAddOpen(true)
  }

  async function handleAddVehicle() {
    setActionMessage(null)

    if (!addForm.license_plate.trim()) {
      setActionMessage("L'immatriculation est obligatoire.")
      return
    }

    setSavingAdd(true)

    const payload = {
      license_plate: addForm.license_plate.trim(),
      brand: addForm.brand.trim() || null,
      model: addForm.model.trim() || null,
      mileage: addForm.mileage ? Number(addForm.mileage) : null,
      next_service_km: addForm.next_service_km
        ? Number(addForm.next_service_km)
        : null,
      parking_location: addForm.parking_location.trim() || null,
      status: addForm.status.trim() || null,
      bodywork_status: addForm.bodywork_status.trim() || null,
      notes: addForm.notes.trim() || null,
      is_archived: false,
      archived_at: null,
      archive_reason: null,
    }

    const { data, error } = await supabase
      .from('vehicles')
      .insert(payload)
      .select('*')
      .single()

    if (error) {
      setActionMessage(`Erreur ajout : ${error.message}`)
      setSavingAdd(false)
      return
    }

    if (data) {
      setVehicleList((prev) => [data as Vehicle, ...prev])
      setActionMessage('Véhicule ajouté avec succès.')
    }

    setSavingAdd(false)
    setAddOpen(false)
    setAddForm(emptyForm)
    router.refresh()
  }

  async function handleSaveVehicle() {
    if (!selectedVehicle) return

    setActionMessage(null)
    setSavingEdit(true)

    const payload = {
      license_plate: editForm.license_plate.trim(),
      brand: editForm.brand.trim() || null,
      model: editForm.model.trim() || null,
      mileage: editForm.mileage ? Number(editForm.mileage) : null,
      next_service_km: editForm.next_service_km
        ? Number(editForm.next_service_km)
        : null,
      parking_location: editForm.parking_location.trim() || null,
      status: editForm.status.trim() || null,
      bodywork_status: editForm.bodywork_status.trim() || null,
      notes: editForm.notes.trim() || null,
    }

    const { data, error } = await supabase
      .from('vehicles')
      .update(payload)
      .eq('id', selectedVehicle.id)
      .select('*')
      .single()

    if (error) {
      setActionMessage(`Erreur modification : ${error.message}`)
      setSavingEdit(false)
      return
    }

    if (data) {
      setVehicleList((prev) =>
        prev.map((v) => (v.id === selectedVehicle.id ? (data as Vehicle) : v))
      )
      setSelectedVehicle(data as Vehicle)
      setActionMessage('Véhicule modifié avec succès.')
    }

    setSavingEdit(false)
    setManageOpen(false)
    router.refresh()
  }

  async function handleArchiveVehicle() {
    if (!selectedVehicle) return

    const confirmed = window.confirm(
      `Envoyer ${selectedVehicle.license_plate} dans “Récemment supprimés” ?`
    )
    if (!confirmed) return

    setActionMessage(null)
    setSavingEdit(true)

    const archiveDate = new Date().toISOString()

    const { error } = await supabase
      .from('vehicles')
      .update({
        is_archived: true,
        archived_at: archiveDate,
        archive_reason: 'deleted_by_user',
      })
      .eq('id', selectedVehicle.id)

    if (error) {
      setActionMessage(`Erreur archivage : ${error.message}`)
      setSavingEdit(false)
      return
    }

    setVehicleList((prev) =>
      prev.map((v) =>
        v.id === selectedVehicle.id
          ? {
              ...v,
              is_archived: true,
              archived_at: archiveDate,
              archive_reason: 'deleted_by_user',
            }
          : v
      )
    )

    setSavingEdit(false)
    setManageOpen(false)
    setActionMessage('Véhicule déplacé dans Récemment supprimés.')
    router.refresh()
  }

  async function handleRestoreVehicle(vehicle: Vehicle) {
    setActionMessage(null)
    setRestoringId(vehicle.id)

    const { error } = await supabase
      .from('vehicles')
      .update({
        is_archived: false,
        archived_at: null,
        archive_reason: null,
      })
      .eq('id', vehicle.id)

    if (error) {
      setActionMessage(`Erreur restauration : ${error.message}`)
      setRestoringId(null)
      return
    }

    setVehicleList((prev) =>
      prev.map((v) =>
        v.id === vehicle.id
          ? { ...v, is_archived: false, archived_at: null, archive_reason: null }
          : v
      )
    )

    setRestoringId(null)
    setActionMessage(`${vehicle.license_plate} a été restauré.`)
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-[#151515] text-white px-4 py-6 md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="mt-1 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#1E1E1E] text-2xl text-white hover:bg-[#262626]"
            >
              ☰
            </button>

            <div>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
                Flotte de véhicules
              </h1>
            </div>
          </div>

          <div className="text-right text-zinc-300 text-lg md:text-2xl">
            {showDeletedPanel
              ? `${archivedVehicles.length} supprimé${
                  archivedVehicles.length > 1 ? 's' : ''
                }`
              : viewMode === 'parking'
              ? `${parkingGroups.length} parking${
                  parkingGroups.length > 1 ? 's' : ''
                }`
              : `${filteredVehicles.length} véhicule${
                  filteredVehicles.length > 1 ? 's' : ''
                }`}
          </div>
        </div>

        {!showDeletedPanel && viewMode !== 'parking' && (
          <>
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <button
                type="button"
                onClick={() => setFilter(filter === 'dispo' ? 'all' : 'dispo')}
                className={`rounded-3xl bg-[#1E1E1E] p-6 text-left transition border ${
                  filter === 'dispo'
                    ? 'border-emerald-500/60'
                    : 'border-transparent'
                }`}
              >
                <p className="text-zinc-300 text-lg">Disponibles</p>
                <p className="mt-4 text-5xl font-semibold text-emerald-400">
                  {countAvailable(vehicleList)}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFilter(filter === 'contrat' ? 'all' : 'contrat')}
                className={`rounded-3xl bg-[#1E1E1E] p-6 text-left transition border ${
                  filter === 'contrat'
                    ? 'border-[#6FAAF2]/60'
                    : 'border-transparent'
                }`}
              >
                <p className="text-zinc-300 text-lg">En contrat LLD</p>
                <p className="mt-4 text-5xl font-semibold text-[#6FAAF2]">
                  {countContract(vehicleList)}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFilter(filter === 'carro' ? 'all' : 'carro')}
                className={`rounded-3xl bg-[#1E1E1E] p-6 text-left transition border ${
                  filter === 'carro'
                    ? 'border-[#F2AE2E]/60'
                    : 'border-transparent'
                }`}
              >
                <p className="text-zinc-300 text-lg">Carrosserie</p>
                <p className="mt-4 text-5xl font-semibold text-[#F2AE2E]">
                  {countBodywork(vehicleList)}
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  setFilter(filter === 'entretien' ? 'all' : 'entretien')
                }
                className={`rounded-3xl bg-[#1E1E1E] p-6 text-left transition border ${
                  filter === 'entretien'
                    ? 'border-[#F55252]/60'
                    : 'border-transparent'
                }`}
              >
                <p className="text-zinc-300 text-lg">Entretien dû</p>
                <p className="mt-4 text-5xl font-semibold text-[#F55252]">
                  {countMaintenance(vehicleList)}
                </p>
              </button>
            </div>

            <div className="mb-6">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par immatriculation, marque, parking, statut ou note"
                className="w-full rounded-2xl border border-white/10 bg-[#1E1E1E] px-5 py-4 text-lg text-white outline-none placeholder:text-zinc-500"
              />
            </div>

            <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-3">
                {[
                  ['all', 'Tous'],
                  ['dispo', 'Disponibles'],
                  ['contrat', 'En contrat'],
                  ['carro', 'Carrosserie'],
                  ['entretien', 'Entretien'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`rounded-2xl border px-6 py-3 text-lg ${
                      filter === key
                        ? 'bg-white text-black border-white'
                        : 'border-white/20 text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="inline-flex w-fit rounded-2xl border border-white/15 bg-[#1E1E1E] p-1">
                <button
                  onClick={() => setViewMode('cards')}
                  className={`rounded-xl px-5 py-2 text-sm md:text-base ${
                    viewMode === 'cards'
                      ? 'bg-white text-black'
                      : 'text-zinc-300'
                  }`}
                >
                  Vue cartes
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`rounded-xl px-5 py-2 text-sm md:text-base ${
                    viewMode === 'list' ? 'bg-white text-black' : 'text-zinc-300'
                  }`}
                >
                  Vue liste
                </button>
                <button
                  onClick={() => {
                    setSelectedParking(null)
                    setViewMode('parking')
                  }}
                  className={`rounded-xl px-5 py-2 text-sm md:text-base ${
                    viewMode === 'parking'
                      ? 'bg-white text-black'
                      : 'text-zinc-300'
                  }`}
                >
                  Vue parkings
                </button>
              </div>
            </div>
          </>
        )}

        {!showDeletedPanel && viewMode === 'parking' && (
          <div className="mb-6 flex justify-end">
            <div className="inline-flex w-fit rounded-2xl border border-white/15 bg-[#1E1E1E] p-1">
              <button
                onClick={() => setViewMode('cards')}
                className="rounded-xl px-5 py-2 text-sm text-zinc-300 md:text-base"
              >
                Vue cartes
              </button>
              <button
                onClick={() => setViewMode('list')}
                className="rounded-xl px-5 py-2 text-sm text-zinc-300 md:text-base"
              >
                Vue liste
              </button>
              <button
                onClick={() => {
                  setSelectedParking(null)
                  setViewMode('parking')
                }}
                className="rounded-xl bg-white px-5 py-2 text-sm text-black md:text-base"
              >
                Vue parkings
              </button>
            </div>
          </div>
        )}

        {actionMessage ? (
          <div className="mb-6 rounded-2xl border border-white/10 bg-[#1E1E1E] px-4 py-3 text-sm text-zinc-300">
            {actionMessage}
          </div>
        ) : null}

        {showDeletedPanel ? (
          <div className="rounded-[28px] border border-white/10 bg-[#1E1E1E] p-6">
            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold">Récemment supprimés</h2>
                <p className="mt-1 text-zinc-400">
                  Les véhicules restent récupérables pendant 30 jours.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowDeletedPanel(false)
                  setFilter('all')
                }}
                className="rounded-2xl border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
              >
                Retour aux véhicules actifs
              </button>
            </div>

            {archivedVehicles.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-4 text-zinc-400">
                Aucun véhicule dans Récemment supprimés.
              </div>
            ) : (
              <div className="space-y-4">
                {archivedVehicles.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-4"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-lg font-semibold text-white">
                          {vehicle.license_plate}
                        </div>
                        <div className="mt-1 text-sm text-zinc-400">
                          {vehicle.brand || '—'} {vehicle.model || ''}
                        </div>
                        <div className="mt-2 text-sm text-zinc-500">
                          Archivé le{' '}
                          {vehicle.archived_at
                            ? new Date(vehicle.archived_at).toLocaleDateString(
                                'fr-FR'
                              )
                            : '—'}{' '}
                          • {daysLeftFromArchive(vehicle.archived_at)} jour
                          {daysLeftFromArchive(vehicle.archived_at) > 1 ? 's' : ''}{' '}
                          restants
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRestoreVehicle(vehicle)}
                        disabled={restoringId === vehicle.id}
                        className="rounded-2xl bg-white px-5 py-3 font-semibold text-black disabled:opacity-50"
                      >
                        {restoringId === vehicle.id
                          ? 'Restauration...'
                          : 'Restaurer'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : viewMode === 'parking' ? (
          selectedParking ? (
            <div className="rounded-[28px] border border-white/10 bg-[#1E1E1E] p-6">
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{selectedParking}</h2>
                  <p className="mt-1 text-zinc-400">
                    {selectedParkingVehicles.length} véhicule
                    {selectedParkingVehicles.length > 1 ? 's' : ''} dans ce parking
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedParking(null)}
                  className="rounded-2xl border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
                >
                  Retour aux parkings
                </button>
              </div>

              <div className="space-y-4">
                {selectedParkingVehicles.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className="rounded-2xl border border-white/10 bg-[#151515] px-5 py-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <Link
                          href={`/vehicles/${vehicle.id}`}
                          className="inline-flex w-fit rounded-2xl bg-[#1B1B1B] px-4 py-2 text-xl font-semibold tracking-wide transition hover:bg-[#2a2a2a]"
                        >
                          {vehicle.license_plate}
                        </Link>

                        <div>
                          <p className="text-zinc-400">Véhicule</p>
                          <p className="text-2xl font-semibold text-white">
                            {vehicle.brand} {vehicle.model}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-6 text-zinc-300">
                          <div>
                            <p className="text-sm text-zinc-500">Km</p>
                            <p className="text-lg">{formatKm(vehicle.mileage)} km</p>
                          </div>
                          <div>
                            <p className="text-sm text-zinc-500">Entretien</p>
                            <p className="text-lg">
                              {formatKm(vehicle.next_service_km)} km
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-zinc-500">Carrosserie</p>
                            <p
                              className={`text-lg font-semibold ${getBodyworkColor(
                                vehicle.bodywork_status
                              )}`}
                            >
                              {getBodyworkLabel(vehicle.bodywork_status)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <div
                          className={`inline-flex w-fit rounded-full px-5 py-2 text-base font-semibold ${getStatusBadge(
                            vehicle.status
                          )}`}
                        >
                          {vehicle.status || '—'}
                        </div>

                        <button
                          type="button"
                          onClick={() => openManage(vehicle)}
                          className="rounded-2xl border border-white/15 px-4 py-2 text-sm font-medium text-white hover:bg-white/5"
                        >
                          Gérer
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 h-3 w-full rounded-full bg-[#101010]">
                      <div
                        className={`h-3 rounded-full ${getProgressColor(vehicle)}`}
                        style={{ width: `${getProgressPercent(vehicle)}%` }}
                      />
                    </div>

                    {vehicle.notes ? (
                      <p className="mt-4 text-sm text-zinc-400">{vehicle.notes}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {parkingGroups.length === 0 ? (
                <div className="rounded-[28px] border border-white/10 bg-[#1E1E1E] p-6 text-zinc-400">
                  Aucun parking trouvé.
                </div>
              ) : (
                parkingGroups.map((group) => (
                  <button
                    key={group.parking}
                    type="button"
                    onClick={() => setSelectedParking(group.parking)}
                    className="rounded-[28px] border border-white/10 bg-[#1E1E1E] p-6 text-left transition hover:bg-[#242424]"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h2 className="text-2xl font-bold text-white">
                        {group.parking}
                      </h2>
                      <span className="rounded-full border border-white/10 bg-[#151515] px-3 py-1 text-sm text-zinc-300">
                        {group.vehicles.length}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {group.vehicles.slice(0, 4).map((vehicle) => (
                        <div
                          key={vehicle.id}
                          className="flex items-center justify-between rounded-xl bg-[#151515] px-3 py-3"
                        >
                          <div>
                            <div className="font-semibold text-white">
                              {vehicle.license_plate}
                            </div>
                            <div className="text-sm text-zinc-400">
                              {vehicle.brand} {vehicle.model}
                            </div>
                          </div>

                          <div
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusBadge(
                              vehicle.status
                            )}`}
                          >
                            {vehicle.status || '—'}
                          </div>
                        </div>
                      ))}
                    </div>

                    {group.vehicles.length > 4 ? (
                      <div className="mt-4 text-sm text-zinc-400">
                        + {group.vehicles.length - 4} autre
                        {group.vehicles.length - 4 > 1 ? 's' : ''} véhicule
                        {group.vehicles.length - 4 > 1 ? 's' : ''}
                      </div>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          )
        ) : viewMode === 'cards' ? (
          <div className="space-y-5">
            {filteredVehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className="rounded-[28px] bg-[#242424] px-6 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <Link
                    href={`/vehicles/${vehicle.id}`}
                    className="inline-flex w-fit rounded-2xl bg-[#1B1B1B] px-4 py-2 text-2xl font-semibold tracking-wide transition hover:bg-[#2a2a2a]"
                  >
                    {vehicle.license_plate}
                  </Link>

                  <div className="flex flex-wrap items-center gap-3">
                    <div
                      className={`inline-flex w-fit rounded-full px-5 py-2 text-xl font-semibold ${getStatusBadge(
                        vehicle.status
                      )}`}
                    >
                      {vehicle.status || '—'}
                    </div>

                    <button
                      type="button"
                      onClick={() => openManage(vehicle)}
                      className="rounded-2xl border border-white/15 px-4 py-2 text-sm font-medium text-white hover:bg-white/5"
                    >
                      Gérer
                    </button>
                  </div>
                </div>

                <Link href={`/vehicles/${vehicle.id}`} className="block">
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                    <div>
                      <p className="text-zinc-400 text-lg">Marque</p>
                      <p className="text-4xl font-semibold leading-tight">
                        {vehicle.brand} {vehicle.model}
                      </p>
                      <p className="mt-5 text-3xl font-medium text-zinc-200">
                        {formatKm(vehicle.mileage)} km
                      </p>
                    </div>

                    <div>
                      <p className="text-zinc-400 text-lg">Emplacement</p>
                      <p className="text-4xl font-semibold leading-tight">
                        {vehicle.parking_location || '—'}
                      </p>
                    </div>

                    <div>
                      <p className="text-zinc-400 text-lg">Carrosserie</p>
                      <p
                        className={`text-4xl font-semibold leading-tight ${getBodyworkColor(
                          vehicle.bodywork_status
                        )}`}
                      >
                        {getBodyworkLabel(vehicle.bodywork_status)}
                      </p>
                    </div>

                    <div className="flex items-end lg:justify-end">
                      <p className="text-2xl text-zinc-300">
                        Prochain entretien:{' '}
                        <span className="font-semibold text-white">
                          {formatKm(vehicle.next_service_km)} km
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="h-3 w-full rounded-full bg-[#151515]">
                      <div
                        className={`h-3 rounded-full ${getProgressColor(vehicle)}`}
                        style={{ width: `${getProgressPercent(vehicle)}%` }}
                      />
                    </div>
                  </div>

                  {vehicle.notes ? (
                    <p className="mt-4 text-lg text-zinc-300">{vehicle.notes}</p>
                  ) : null}
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#1E1E1E]">
            <div className="hidden grid-cols-8 gap-4 border-b border-white/10 bg-[#181818] px-6 py-4 text-sm font-medium text-zinc-400 md:grid">
              <div>Immatriculation</div>
              <div>Véhicule</div>
              <div>Km</div>
              <div>Entretien</div>
              <div>Parking</div>
              <div>Statut</div>
              <div>Carrosserie</div>
              <div>Action</div>
            </div>

            <div className="divide-y divide-white/10">
              {filteredVehicles.map((vehicle) => (
                <div
                  key={vehicle.id}
                  className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-8 md:items-center hover:bg-white/[0.03] transition"
                >
                  <Link href={`/vehicles/${vehicle.id}`} className="block">
                    <p className="text-xs text-zinc-500 md:hidden">
                      Immatriculation
                    </p>
                    <p className="font-semibold text-white">
                      {vehicle.license_plate}
                    </p>
                  </Link>

                  <Link href={`/vehicles/${vehicle.id}`} className="block">
                    <p className="text-xs text-zinc-500 md:hidden">Véhicule</p>
                    <p className="text-white">
                      {vehicle.brand} {vehicle.model}
                    </p>
                  </Link>

                  <Link href={`/vehicles/${vehicle.id}`} className="block">
                    <p className="text-xs text-zinc-500 md:hidden">Km</p>
                    <p className="text-zinc-200">{formatKm(vehicle.mileage)} km</p>
                  </Link>

                  <Link href={`/vehicles/${vehicle.id}`} className="block">
                    <p className="text-xs text-zinc-500 md:hidden">Entretien</p>
                    <p className="text-zinc-200">
                      {formatKm(vehicle.next_service_km)} km
                    </p>
                  </Link>

                  <Link href={`/vehicles/${vehicle.id}`} className="block">
                    <p className="text-xs text-zinc-500 md:hidden">Parking</p>
                    <p className="text-zinc-200">
                      {vehicle.parking_location || '—'}
                    </p>
                  </Link>

                  <Link href={`/vehicles/${vehicle.id}`} className="block">
                    <p className="text-xs text-zinc-500 md:hidden">Statut</p>
                    <span
                      className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-medium ${getStatusBadge(
                        vehicle.status
                      )}`}
                    >
                      {vehicle.status || '—'}
                    </span>
                  </Link>

                  <Link href={`/vehicles/${vehicle.id}`} className="block">
                    <p className="text-xs text-zinc-500 md:hidden">Carrosserie</p>
                    <p
                      className={`font-medium ${getBodyworkColor(
                        vehicle.bodywork_status
                      )}`}
                    >
                      {getBodyworkLabel(vehicle.bodywork_status)}
                    </p>
                  </Link>

                  <div>
                    <button
                      type="button"
                      onClick={() => openManage(vehicle)}
                      className="rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-white hover:bg-white/5"
                    >
                      Gérer
                    </button>
                  </div>

                  {vehicle.notes ? (
                    <div className="md:col-span-8">
                      <p className="text-sm text-zinc-400">{vehicle.notes}</p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed left-0 top-0 z-50 h-full w-[320px] max-w-[85vw] border-r border-white/10 bg-[#121212] p-5 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setSidebarOpen(false)
                  setShowDeletedPanel(false)
                  setFilter('all')
                  setSelectedParking(null)
                }}
                className="flex-1 rounded-2xl border border-white/10 bg-[#1E1E1E] px-4 py-4 text-left hover:bg-white/5"
              >
                <div className="text-sm font-medium text-zinc-400">
                  Menu principal
                </div>
                <div className="mt-1 text-2xl font-bold text-white">Menu</div>
              </button>

              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300"
              >
                Fermer
              </button>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setSidebarOpen(false)
                  setShowDeletedPanel(false)
                  setFilter('all')
                  setSelectedParking(null)
                  setViewMode('cards')
                }}
                className="w-full rounded-2xl border border-white/10 bg-[#1E1E1E] px-4 py-4 text-left text-lg font-semibold hover:bg-white/5"
              >
                Véhicules actifs
              </button>

              <button
                type="button"
                onClick={() => {
                  setSidebarOpen(false)
                  setShowDeletedPanel(true)
                  setSelectedParking(null)
                }}
                className="w-full rounded-2xl border border-white/10 bg-[#1E1E1E] px-4 py-4 text-left text-lg font-semibold hover:bg-white/5"
              >
                Récemment supprimés
              </button>

              <button
                type="button"
                onClick={openAddModal}
                className="w-full rounded-2xl border border-white/10 bg-white px-4 py-4 text-left text-lg font-semibold text-black"
              >
                Ajouter un véhicule
              </button>
            </div>
          </div>
        </>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-[#1E1E1E] p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Ajouter un véhicule</h2>
              <button
                type="button"
                onClick={() => {
                  setAddOpen(false)
                  setAddForm(emptyForm)
                }}
                className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300"
              >
                Fermer
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <input
                value={addForm.license_plate}
                onChange={(e) =>
                  updateAddForm('license_plate', e.target.value)
                }
                placeholder="Immatriculation"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
              <input
                value={addForm.brand}
                onChange={(e) => updateAddForm('brand', e.target.value)}
                placeholder="Marque"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
              <input
                value={addForm.model}
                onChange={(e) => updateAddForm('model', e.target.value)}
                placeholder="Modèle"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
              <input
                value={addForm.mileage}
                onChange={(e) => updateAddForm('mileage', e.target.value)}
                placeholder="Kilométrage"
                type="number"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
              <input
                value={addForm.next_service_km}
                onChange={(e) =>
                  updateAddForm('next_service_km', e.target.value)
                }
                placeholder="Prochain entretien"
                type="number"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
              <input
                value={addForm.parking_location}
                onChange={(e) =>
                  updateAddForm('parking_location', e.target.value)
                }
                placeholder="Emplacement parking"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />

              <select
                value={addForm.status}
                onChange={(e) => updateAddForm('status', e.target.value)}
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              >
                <option value="Disponible">Disponible</option>
                <option value="En contrat LLD">En contrat LLD</option>
                <option value="Carrosserie en cours">Carrosserie en cours</option>
                <option value="Entretien">Entretien</option>
                <option value="Indisponible">Indisponible</option>
              </select>

              <select
                value={addForm.bodywork_status}
                onChange={(e) =>
                  updateAddForm('bodywork_status', e.target.value)
                }
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              >
                <option value="ok">OK</option>
                <option value="a_verifier">À vérifier</option>
                <option value="en_cours">En réparation</option>
                <option value="urgent">Urgent</option>
              </select>

              <textarea
                value={addForm.notes}
                onChange={(e) => updateAddForm('notes', e.target.value)}
                placeholder="Notes"
                className="md:col-span-2 min-h-[120px] rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleAddVehicle}
                disabled={savingAdd}
                className="rounded-2xl bg-white px-5 py-3 font-semibold text-black disabled:opacity-50"
              >
                {savingAdd ? 'Ajout...' : 'Enregistrer le véhicule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {manageOpen && selectedVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-[#1E1E1E] p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                Gérer {selectedVehicle.license_plate}
              </h2>
              <button
                type="button"
                onClick={() => setManageOpen(false)}
                className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300"
              >
                Fermer
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <input
                value={editForm.license_plate}
                onChange={(e) =>
                  updateEditForm('license_plate', e.target.value)
                }
                placeholder="Immatriculation"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
              <input
                value={editForm.brand}
                onChange={(e) => updateEditForm('brand', e.target.value)}
                placeholder="Marque"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
              <input
                value={editForm.model}
                onChange={(e) => updateEditForm('model', e.target.value)}
                placeholder="Modèle"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
              <input
                value={editForm.mileage}
                onChange={(e) => updateEditForm('mileage', e.target.value)}
                placeholder="Kilométrage"
                type="number"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
              <input
                value={editForm.next_service_km}
                onChange={(e) =>
                  updateEditForm('next_service_km', e.target.value)
                }
                placeholder="Prochain entretien"
                type="number"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
              <input
                value={editForm.parking_location}
                onChange={(e) =>
                  updateEditForm('parking_location', e.target.value)
                }
                placeholder="Emplacement parking"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />

              <select
                value={editForm.status}
                onChange={(e) => updateEditForm('status', e.target.value)}
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              >
                <option value="Disponible">Disponible</option>
                <option value="En contrat LLD">En contrat LLD</option>
                <option value="Carrosserie en cours">Carrosserie en cours</option>
                <option value="Entretien">Entretien</option>
                <option value="Indisponible">Indisponible</option>
              </select>

              <select
                value={editForm.bodywork_status}
                onChange={(e) =>
                  updateEditForm('bodywork_status', e.target.value)
                }
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              >
                <option value="ok">OK</option>
                <option value="a_verifier">À vérifier</option>
                <option value="en_cours">En réparation</option>
                <option value="urgent">Urgent</option>
              </select>

              <textarea
                value={editForm.notes}
                onChange={(e) => updateEditForm('notes', e.target.value)}
                placeholder="Notes"
                className="md:col-span-2 min-h-[120px] rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3 justify-between">
              <button
                type="button"
                onClick={handleArchiveVehicle}
                disabled={savingEdit}
                className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 font-semibold text-red-300 disabled:opacity-50"
              >
                Supprimer (30 jours)
              </button>

              <button
                type="button"
                onClick={handleSaveVehicle}
                disabled={savingEdit}
                className="rounded-2xl bg-white px-5 py-3 font-semibold text-black disabled:opacity-50"
              >
                {savingEdit ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}