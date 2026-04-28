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

type ParkingLink = {
  id: number
  name: string
  entry_address: string | null
  exit_address: string | null
  parking_url: string | null
  notes: string | null
}

type Props = {
  vehicles: Vehicle[]
  parkingLinks: ParkingLink[]
}

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

type ParkingForm = {
  name: string
  entry_address: string
  exit_address: string
  parking_url: string
  notes: string
}

type ViewMode = 'cards' | 'list' | 'parking'
type PageMode = 'vehicles' | 'parkingLinks' | 'deleted' | 'assurances' | 'claims'
type FilterKey = 'dispo' | 'jr' | 'carro' | 'entretien'

const emptyVehicleForm: VehicleForm = {
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

const emptyParkingForm: ParkingForm = {
  name: '',
  entry_address: '',
  exit_address: '',
  parking_url: '',
  notes: '',
}

const filterConfig: { key: FilterKey; label: string }[] = [
  { key: 'dispo', label: 'Disponibles' },
  { key: 'jr', label: 'JR' },
  { key: 'carro', label: 'Carrosserie' },
  { key: 'entretien', label: 'Entretien' },
]

const normalize = (value: string | null | undefined) =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()

const parkingNameOf = (value: string | null | undefined) => (value || '').trim() || 'Sans parking'

const formatKm = (value: number | null) =>
  value === null || value === undefined ? '—' : new Intl.NumberFormat('fr-FR').format(value)

const getStatusText = (status: string | null) => {
  const s = normalize(status)
  if (s.includes('contrat') || s === 'jr') return 'JR'
  if (s.includes('disponible')) return 'Disponible'
  if (s.includes('carrosserie')) return 'Carrosserie'
  if (s.includes('entretien')) return 'Entretien'
  if (s.includes('indispo')) return 'Indisponible'
  return status || '—'
}

const getStatusBadge = (status: string | null) => {
  const s = normalize(status)
  if (s.includes('disponible')) return 'bg-[#E8F1D9] text-[#3D5A1D]'
  if (s.includes('contrat') || s === 'jr') return 'bg-[#DCE9F9] text-[#245B9B]'
  if (s.includes('carrosserie')) return 'bg-[#F2E6D3] text-[#8B5A1A]'
  if (s.includes('entretien')) return 'bg-[#3a0f0f] text-[#ff6b6b]'
  if (s.includes('indispo')) return 'bg-zinc-700 text-zinc-200'
  return 'bg-zinc-700 text-zinc-100'
}

const getBodyworkLabel = (value: string | null) => {
  const v = normalize(value)
  if (v === 'ok') return 'OK'
  if (v === 'a_verifier') return 'À vérifier'
  if (v === 'en_cours') return 'En réparation'
  if (v === 'urgent') return 'Urgent'
  return value || '—'
}

const getBodyworkColor = (value: string | null) => {
  const v = normalize(value)
  if (v === 'ok') return 'text-emerald-400'
  if (v === 'a_verifier') return 'text-amber-400'
  if (v === 'en_cours' || v === 'urgent') return 'text-red-400'
  return 'text-zinc-300'
}

const getProgressColor = (vehicle: Vehicle) => {
  const status = normalize(vehicle.status)
  const mileage = vehicle.mileage || 0
  const nextService = vehicle.next_service_km || 0
  if (status.includes('carrosserie')) return 'bg-[#19C08A]'
  if (nextService > 0 && mileage >= nextService - 3000) return 'bg-[#F55252]'
  return 'bg-[#F2AE2E]'
}

const getProgressPercent = (vehicle: Vehicle) => {
  const mileage = vehicle.mileage || 0
  const nextService = vehicle.next_service_km || 0
  if (!nextService || nextService <= 0) return 35
  return Math.max(Math.min((mileage / nextService) * 100, 100), 10)
}

const daysLeftFromArchive = (archivedAt: string | null | undefined) => {
  if (!archivedAt) return 30
  const diff = Date.now() - new Date(archivedAt).getTime()
  return Math.max(0, 30 - Math.floor(diff / (1000 * 60 * 60 * 24)))
}

const matchesFilter = (vehicle: Vehicle, filter: FilterKey) => {
  const status = normalize(vehicle.status)
  const mileage = vehicle.mileage || 0
  const nextService = vehicle.next_service_km || 0

  if (filter === 'dispo') return status.includes('disponible')
  if (filter === 'jr') return status.includes('contrat') || status === 'jr'
  if (filter === 'carro') return status.includes('carrosserie')
  return nextService > 0 && mileage >= nextService - 3000
}

const toVehicleForm = (vehicle: Vehicle): VehicleForm => ({
  license_plate: vehicle.license_plate || '',
  brand: vehicle.brand || '',
  model: vehicle.model || '',
  mileage: vehicle.mileage?.toString() || '',
  next_service_km: vehicle.next_service_km?.toString() || '',
  parking_location: vehicle.parking_location || '',
  status: vehicle.status || 'Disponible',
  bodywork_status: vehicle.bodywork_status || 'ok',
  notes: vehicle.notes || '',
})

const toParkingForm = (parking: ParkingLink): ParkingForm => ({
  name: parking.name || '',
  entry_address: parking.entry_address || '',
  exit_address: parking.exit_address || '',
  parking_url: parking.parking_url || '',
  notes: parking.notes || '',
})

export default function VehicleDashboard({ vehicles, parkingLinks }: Props) {
  const router = useRouter()

  const [vehicleList, setVehicleList] = useState<Vehicle[]>(vehicles)
  const [parkingList, setParkingList] = useState<ParkingLink[]>(parkingLinks)

  const [pageMode, setPageMode] = useState<PageMode>('vehicles')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')

  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<FilterKey[]>([])
  const [selectedParking, setSelectedParking] = useState<string | null>(null)

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [addVehicleOpen, setAddVehicleOpen] = useState(false)
  const [manageVehicleOpen, setManageVehicleOpen] = useState(false)
  const [addParkingOpen, setAddParkingOpen] = useState(false)
  const [manageParkingOpen, setManageParkingOpen] = useState(false)

  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [selectedParkingLink, setSelectedParkingLink] = useState<ParkingLink | null>(null)

  const [vehicleForm, setVehicleForm] = useState<VehicleForm>(emptyVehicleForm)
  const [editVehicleForm, setEditVehicleForm] = useState<VehicleForm>(emptyVehicleForm)
  const [parkingForm, setParkingForm] = useState<ParkingForm>(emptyParkingForm)

  const [savingVehicle, setSavingVehicle] = useState(false)
  const [savingEditVehicle, setSavingEditVehicle] = useState(false)
  const [savingParking, setSavingParking] = useState(false)
  const [restoringId, setRestoringId] = useState<number | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

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

  const parkingCounts = useMemo(() => {
    const map = new Map<string, number>()
    activeVehicles.forEach((v) => {
      const name = parkingNameOf(v.parking_location)
      map.set(name, (map.get(name) || 0) + 1)
    })
    return map
  }, [activeVehicles])

  const parkingNames = useMemo(
    () => Array.from(parkingCounts.keys()).sort((a, b) => a.localeCompare(b)),
    [parkingCounts]
  )

  const mergedParkingLinks = useMemo(() => {
    const map = new Map<string, ParkingLink>()

    parkingList.forEach((p) => map.set(normalize(p.name), p))

    parkingNames.forEach((name, index) => {
      if (!map.has(normalize(name))) {
        map.set(normalize(name), {
          id: -(index + 1),
          name,
          entry_address: null,
          exit_address: null,
          parking_url: null,
          notes: null,
        })
      }
    })

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [parkingList, parkingNames])

  const filteredVehicles = useMemo(() => {
    const q = normalize(search)

    return activeVehicles.filter((vehicle) => {
      const searchable = normalize(
        [
          vehicle.license_plate,
          vehicle.brand,
          vehicle.model,
          vehicle.parking_location,
          vehicle.status,
          vehicle.bodywork_status,
          vehicle.notes,
        ].join(' ')
      )

      const searchOk = !q || searchable.includes(q)
      const filtersOk = activeFilters.every((filter) => matchesFilter(vehicle, filter))
      const parkingOk =
        viewMode !== 'parking' || !selectedParking
          ? true
          : normalize(parkingNameOf(vehicle.parking_location)) === normalize(selectedParking)

      return searchOk && filtersOk && parkingOk
    })
  }, [activeVehicles, search, activeFilters, viewMode, selectedParking])

  const visibleParkingNames = useMemo(() => {
    const q = normalize(search)
    return parkingNames.filter((name) => !q || normalize(name).includes(q))
  }, [parkingNames, search])

  const visibleParkingLinks = useMemo(() => {
    const q = normalize(search)
    return mergedParkingLinks.filter((parking) => {
      const searchable = normalize(
        [parking.name, parking.entry_address, parking.exit_address, parking.parking_url, parking.notes].join(
          ' '
        )
      )
      return !q || searchable.includes(q)
    })
  }, [mergedParkingLinks, search])

  const stats = useMemo(
    () => ({
      dispo: activeVehicles.filter((v) => matchesFilter(v, 'dispo')).length,
      jr: activeVehicles.filter((v) => matchesFilter(v, 'jr')).length,
      carro: activeVehicles.filter((v) => matchesFilter(v, 'carro')).length,
      entretien: activeVehicles.filter((v) => matchesFilter(v, 'entretien')).length,
    }),
    [activeVehicles]
  )

  const updateVehicleForm = (key: keyof VehicleForm, value: string) =>
    setVehicleForm((prev) => ({ ...prev, [key]: value }))

  const updateEditVehicleForm = (key: keyof VehicleForm, value: string) =>
    setEditVehicleForm((prev) => ({ ...prev, [key]: value }))

  const updateParkingForm = (key: keyof ParkingForm, value: string) =>
    setParkingForm((prev) => ({ ...prev, [key]: value }))

  const toggleFilter = (key: FilterKey) =>
    setActiveFilters((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]))

  const resetToMain = () => {
    setSidebarOpen(false)
    setPageMode('vehicles')
    setViewMode('cards')
    setSelectedParking(null)
    setActionMessage(null)
  }

  const openAddVehicleModal = () => {
    setSidebarOpen(false)
    setVehicleForm(emptyVehicleForm)
    setAddVehicleOpen(true)
    setActionMessage(null)
  }

  const openManageVehicle = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle)
    setEditVehicleForm(toVehicleForm(vehicle))
    setManageVehicleOpen(true)
    setActionMessage(null)
  }

  const openAddParkingModal = () => {
    setSidebarOpen(false)
    setParkingForm(emptyParkingForm)
    setAddParkingOpen(true)
    setActionMessage(null)
  }

  const openManageParking = (parking: ParkingLink) => {
    setSelectedParkingLink(parking)
    setParkingForm(toParkingForm(parking))
    setManageParkingOpen(true)
    setActionMessage(null)
  }

  const openParkingVehicles = (parkingName: string) => {
    setPageMode('vehicles')
    setViewMode('parking')
    setSelectedParking(parkingName)
    setSidebarOpen(false)
  }

  const goToParkingLinks = () => {
    setSidebarOpen(false)
    setPageMode('parkingLinks')
    setSearch('')
    setActionMessage(null)
  }

  const goToDeleted = () => {
    setSidebarOpen(false)
    setPageMode('deleted')
    setActionMessage(null)
  }

  const goToAssurances = () => {
    setSidebarOpen(false)
    setPageMode('assurances')
    setActionMessage(null)
  }

  const goToClaims = () => {
    setSidebarOpen(false)
    setPageMode('claims')
    setActionMessage(null)
  }

  async function handleAddVehicle() {
    setActionMessage(null)
    if (!vehicleForm.license_plate.trim()) {
      setActionMessage("L'immatriculation est obligatoire.")
      return
    }

    setSavingVehicle(true)

    const payload = {
      license_plate: vehicleForm.license_plate.trim(),
      brand: vehicleForm.brand.trim() || null,
      model: vehicleForm.model.trim() || null,
      mileage: vehicleForm.mileage ? Number(vehicleForm.mileage) : null,
      next_service_km: vehicleForm.next_service_km ? Number(vehicleForm.next_service_km) : null,
      parking_location: vehicleForm.parking_location.trim() || null,
      status: vehicleForm.status.trim() || null,
      bodywork_status: vehicleForm.bodywork_status.trim() || null,
      notes: vehicleForm.notes.trim() || null,
      is_archived: false,
      archived_at: null,
      archive_reason: null,
    }

    const { data, error } = await supabase.from('vehicles').insert(payload).select('*').single()

    if (error) {
      setActionMessage(`Erreur ajout véhicule : ${error.message}`)
      setSavingVehicle(false)
      return
    }

    if (data) {
      setVehicleList((prev) => [data as Vehicle, ...prev])
      setAddVehicleOpen(false)
      setVehicleForm(emptyVehicleForm)
      setActionMessage('Véhicule ajouté avec succès.')
      router.refresh()
    }

    setSavingVehicle(false)
  }

  async function handleSaveVehicle() {
    if (!selectedVehicle) return

    setSavingEditVehicle(true)
    setActionMessage(null)

    const payload = {
      license_plate: editVehicleForm.license_plate.trim(),
      brand: editVehicleForm.brand.trim() || null,
      model: editVehicleForm.model.trim() || null,
      mileage: editVehicleForm.mileage ? Number(editVehicleForm.mileage) : null,
      next_service_km: editVehicleForm.next_service_km ? Number(editVehicleForm.next_service_km) : null,
      parking_location: editVehicleForm.parking_location.trim() || null,
      status: editVehicleForm.status.trim() || null,
      bodywork_status: editVehicleForm.bodywork_status.trim() || null,
      notes: editVehicleForm.notes.trim() || null,
    }

    const { data, error } = await supabase
      .from('vehicles')
      .update(payload)
      .eq('id', selectedVehicle.id)
      .select('*')
      .single()

    if (error) {
      setActionMessage(`Erreur modification véhicule : ${error.message}`)
      setSavingEditVehicle(false)
      return
    }

    if (data) {
      setVehicleList((prev) => prev.map((v) => (v.id === selectedVehicle.id ? (data as Vehicle) : v)))
      setManageVehicleOpen(false)
      setSelectedVehicle(data as Vehicle)
      setActionMessage('Véhicule modifié avec succès.')
      router.refresh()
    }

    setSavingEditVehicle(false)
  }

  async function handleArchiveVehicle() {
    if (!selectedVehicle) return

    const confirmed = window.confirm(
      `Envoyer ${selectedVehicle.license_plate} dans “Récemment supprimés” ?`
    )
    if (!confirmed) return

    setSavingEditVehicle(true)
    setActionMessage(null)

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
      setSavingEditVehicle(false)
      return
    }

    setVehicleList((prev) =>
      prev.map((v) =>
        v.id === selectedVehicle.id
          ? { ...v, is_archived: true, archived_at: archiveDate, archive_reason: 'deleted_by_user' }
          : v
      )
    )

    setManageVehicleOpen(false)
    setSavingEditVehicle(false)
    setActionMessage('Véhicule déplacé dans Récemment supprimés.')
    router.refresh()
  }

  async function handleRestoreVehicle(vehicle: Vehicle) {
    setRestoringId(vehicle.id)
    setActionMessage(null)

    const { error } = await supabase
      .from('vehicles')
      .update({ is_archived: false, archived_at: null, archive_reason: null })
      .eq('id', vehicle.id)

    if (error) {
      setActionMessage(`Erreur restauration : ${error.message}`)
      setRestoringId(null)
      return
    }

    setVehicleList((prev) =>
      prev.map((v) => (v.id === vehicle.id ? { ...v, is_archived: false, archived_at: null, archive_reason: null } : v))
    )

    setRestoringId(null)
    setActionMessage(`${vehicle.license_plate} a été restauré.`)
    router.refresh()
  }

  async function handleAddParking() {
    setActionMessage(null)
    if (!parkingForm.name.trim()) {
      setActionMessage('Le nom du parking est obligatoire.')
      return
    }

    setSavingParking(true)

    const payload = {
      name: parkingForm.name.trim(),
      entry_address: parkingForm.entry_address.trim() || null,
      exit_address: parkingForm.exit_address.trim() || null,
      parking_url: parkingForm.parking_url.trim() || null,
      notes: parkingForm.notes.trim() || null,
    }

    const { data, error } = await supabase.from('parkings').insert(payload).select('*').single()

    if (error) {
      setActionMessage(`Erreur ajout parking : ${error.message}`)
      setSavingParking(false)
      return
    }

    if (data) {
      setParkingList((prev) => [...prev, data as ParkingLink])
      setAddParkingOpen(false)
      setParkingForm(emptyParkingForm)
      setActionMessage('Parking ajouté avec succès.')
      router.refresh()
    }

    setSavingParking(false)
  }

  async function handleSaveParking() {
    if (!selectedParkingLink) return

    setActionMessage(null)
    setSavingParking(true)

    const payload = {
      name: parkingForm.name.trim(),
      entry_address: parkingForm.entry_address.trim() || null,
      exit_address: parkingForm.exit_address.trim() || null,
      parking_url: parkingForm.parking_url.trim() || null,
      notes: parkingForm.notes.trim() || null,
    }

    const isVirtual = selectedParkingLink.id < 0

    const query = isVirtual
      ? supabase.from('parkings').insert(payload).select('*').single()
      : supabase.from('parkings').update(payload).eq('id', selectedParkingLink.id).select('*').single()

    const { data, error } = await query

    if (error) {
      setActionMessage(`Erreur parking : ${error.message}`)
      setSavingParking(false)
      return
    }

    if (data) {
      setParkingList((prev) =>
        isVirtual
          ? [...prev, data as ParkingLink]
          : prev.map((p) => (p.id === selectedParkingLink.id ? (data as ParkingLink) : p))
      )

      setManageParkingOpen(false)
      setSelectedParkingLink(data as ParkingLink)
      setActionMessage('Parking enregistré avec succès.')
      router.refresh()
    }

    setSavingParking(false)
  }

  const title =
    pageMode === 'parkingLinks'
      ? 'Liens parkings'
      : pageMode === 'deleted'
      ? 'Récemment supprimés'
      : pageMode === 'assurances'
      ? 'Assurances'
      : pageMode === 'claims'
      ? 'Sinistres'
      : 'Flotte de véhicules'

  const countLabel =
    pageMode === 'parkingLinks'
      ? `${visibleParkingLinks.length} parking${visibleParkingLinks.length > 1 ? 's' : ''}`
      : pageMode === 'deleted'
      ? `${archivedVehicles.length} supprimé${archivedVehicles.length > 1 ? 's' : ''}`
      : pageMode === 'vehicles' && viewMode === 'parking' && !selectedParking
      ? `${visibleParkingNames.length} parking${visibleParkingNames.length > 1 ? 's' : ''}`
      : pageMode === 'vehicles'
      ? `${filteredVehicles.length} véhicule${filteredVehicles.length > 1 ? 's' : ''}`
      : ''

  const renderVehicleCard = (vehicle: Vehicle) => (
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
            {getStatusText(vehicle.status)}
          </div>

          <button
            type="button"
            onClick={() => openManageVehicle(vehicle)}
            className="rounded-2xl border border-white/15 px-4 py-2 text-sm font-medium text-white hover:bg-white/5"
          >
            Gérer
          </button>
        </div>
      </div>

      <Link href={`/vehicles/${vehicle.id}`} className="block">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div>
            <p className="text-lg text-zinc-400">Marque</p>
            <p className="text-4xl font-semibold leading-tight">
              {vehicle.brand} {vehicle.model}
            </p>
            <p className="mt-5 text-3xl font-medium text-zinc-200">{formatKm(vehicle.mileage)} km</p>
          </div>

          <div>
            <p className="text-lg text-zinc-400">Emplacement</p>
            <p className="text-4xl font-semibold leading-tight">{parkingNameOf(vehicle.parking_location)}</p>
          </div>

          <div>
            <p className="text-lg text-zinc-400">Carrosserie</p>
            <p className={`text-4xl font-semibold leading-tight ${getBodyworkColor(vehicle.bodywork_status)}`}>
              {getBodyworkLabel(vehicle.bodywork_status)}
            </p>
          </div>

          <div className="flex items-end lg:justify-end">
            <p className="text-2xl text-zinc-300">
              Prochain entretien :{' '}
              <span className="font-semibold text-white">{formatKm(vehicle.next_service_km)} km</span>
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

        {vehicle.notes ? <p className="mt-4 text-lg text-zinc-300">{vehicle.notes}</p> : null}
      </Link>
    </div>
  )

  return (
    <main className="min-h-screen bg-[#151515] px-4 py-6 text-white md:px-10">
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

            <h1 className="text-3xl font-bold tracking-tight md:text-5xl">{title}</h1>
          </div>

          <div className="text-right text-lg text-zinc-300 md:text-2xl">{countLabel}</div>
        </div>

        {actionMessage ? (
          <div className="mb-6 rounded-2xl border border-white/10 bg-[#1E1E1E] px-4 py-3 text-sm text-zinc-300">
            {actionMessage}
          </div>
        ) : null}

        {pageMode === 'vehicles' && (
          <>
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <button
                type="button"
                onClick={() => toggleFilter('dispo')}
                className={`rounded-3xl border bg-[#1E1E1E] p-6 text-left transition ${
                  activeFilters.includes('dispo') ? 'border-emerald-500/60' : 'border-transparent'
                }`}
              >
                <p className="text-lg text-zinc-300">Disponibles</p>
                <p className="mt-4 text-5xl font-semibold text-emerald-400">{stats.dispo}</p>
              </button>

              <button
                type="button"
                onClick={() => toggleFilter('jr')}
                className={`rounded-3xl border bg-[#1E1E1E] p-6 text-left transition ${
                  activeFilters.includes('jr') ? 'border-[#6FAAF2]/60' : 'border-transparent'
                }`}
              >
                <p className="text-lg text-zinc-300">JR</p>
                <p className="mt-4 text-5xl font-semibold text-[#6FAAF2]">{stats.jr}</p>
              </button>

              <button
                type="button"
                onClick={() => toggleFilter('carro')}
                className={`rounded-3xl border bg-[#1E1E1E] p-6 text-left transition ${
                  activeFilters.includes('carro') ? 'border-[#F2AE2E]/60' : 'border-transparent'
                }`}
              >
                <p className="text-lg text-zinc-300">Carrosserie</p>
                <p className="mt-4 text-5xl font-semibold text-[#F2AE2E]">{stats.carro}</p>
              </button>

              <button
                type="button"
                onClick={() => toggleFilter('entretien')}
                className={`rounded-3xl border bg-[#1E1E1E] p-6 text-left transition ${
                  activeFilters.includes('entretien') ? 'border-[#F55252]/60' : 'border-transparent'
                }`}
              >
                <p className="text-lg text-zinc-300">Entretien dû</p>
                <p className="mt-4 text-5xl font-semibold text-[#F55252]">{stats.entretien}</p>
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

            <div className="mb-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setActiveFilters([])}
                  className={`rounded-2xl border px-6 py-3 text-lg ${
                    activeFilters.length === 0 ? 'border-white bg-white text-black' : 'border-white/20 text-white'
                  }`}
                >
                  Tous
                </button>

                {filterConfig.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => toggleFilter(item.key)}
                    className={`rounded-2xl border px-6 py-3 text-lg ${
                      activeFilters.includes(item.key)
                        ? 'border-white bg-white text-black'
                        : 'border-white/20 text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="inline-flex w-fit rounded-2xl border border-white/15 bg-[#1E1E1E] p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`rounded-xl px-5 py-2 text-sm md:text-base ${
                    viewMode === 'cards' ? 'bg-white text-black' : 'text-zinc-300'
                  }`}
                >
                  Vue cartes
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`rounded-xl px-5 py-2 text-sm md:text-base ${
                    viewMode === 'list' ? 'bg-white text-black' : 'text-zinc-300'
                  }`}
                >
                  Vue liste
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('parking')}
                  className={`rounded-xl px-5 py-2 text-sm md:text-base ${
                    viewMode === 'parking' ? 'bg-white text-black' : 'text-zinc-300'
                  }`}
                >
                  Vue parkings
                </button>
              </div>
            </div>

            {viewMode === 'parking' && (
              <div className="mb-6 rounded-[28px] border border-white/10 bg-[#1E1E1E] p-5">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedParking(null)}
                    className={`rounded-2xl border px-4 py-2 text-sm ${
                      selectedParking === null ? 'border-white bg-white text-black' : 'border-white/15 text-zinc-300'
                    }`}
                  >
                    Tous les parkings
                  </button>

                  {visibleParkingNames.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setSelectedParking(name)}
                      className={`rounded-2xl border px-4 py-2 text-sm ${
                        selectedParking === name
                          ? 'border-white bg-white text-black'
                          : 'border-white/15 text-zinc-300'
                      }`}
                    >
                      {name} <span className="ml-1 text-xs opacity-70">({parkingCounts.get(name) || 0})</span>
                    </button>
                  ))}
                </div>

                <p className="text-sm text-zinc-400">
                  Astuce : clique sur un parking pour afficher directement les véhicules et accéder plus vite à leurs
                  inspections.
                </p>
              </div>
            )}

            {viewMode === 'cards' || viewMode === 'parking' ? (
              filteredVehicles.length ? (
                <div className="space-y-5">{filteredVehicles.map(renderVehicleCard)}</div>
              ) : (
                <div className="rounded-[28px] border border-white/10 bg-[#1E1E1E] p-6 text-zinc-400">
                  Aucun véhicule trouvé.
                </div>
              )
            ) : filteredVehicles.length ? (
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
                      className="grid grid-cols-1 gap-4 px-6 py-5 transition hover:bg-white/[0.03] md:grid-cols-8 md:items-center"
                    >
                      <Link href={`/vehicles/${vehicle.id}`} className="block">
                        <p className="text-xs text-zinc-500 md:hidden">Immatriculation</p>
                        <p className="font-semibold text-white">{vehicle.license_plate}</p>
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
                        <p className="text-zinc-200">{formatKm(vehicle.next_service_km)} km</p>
                      </Link>

                      <Link href={`/vehicles/${vehicle.id}`} className="block">
                        <p className="text-xs text-zinc-500 md:hidden">Parking</p>
                        <p className="text-zinc-200">{parkingNameOf(vehicle.parking_location)}</p>
                      </Link>

                      <Link href={`/vehicles/${vehicle.id}`} className="block">
                        <p className="text-xs text-zinc-500 md:hidden">Statut</p>
                        <span
                          className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-medium ${getStatusBadge(
                            vehicle.status
                          )}`}
                        >
                          {getStatusText(vehicle.status)}
                        </span>
                      </Link>

                      <Link href={`/vehicles/${vehicle.id}`} className="block">
                        <p className="text-xs text-zinc-500 md:hidden">Carrosserie</p>
                        <p className={`font-medium ${getBodyworkColor(vehicle.bodywork_status)}`}>
                          {getBodyworkLabel(vehicle.bodywork_status)}
                        </p>
                      </Link>

                      <div>
                        <button
                          type="button"
                          onClick={() => openManageVehicle(vehicle)}
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
            ) : (
              <div className="rounded-[28px] border border-white/10 bg-[#1E1E1E] p-6 text-zinc-400">
                Aucun véhicule trouvé.
              </div>
            )}
          </>
        )}

        {pageMode === 'parkingLinks' && (
          <>
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex-1">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher par nom, adresse entrée, adresse sortie ou lien"
                  className="w-full rounded-2xl border border-white/10 bg-[#1E1E1E] px-5 py-4 text-lg text-white outline-none placeholder:text-zinc-500"
                />
              </div>

              <button
                type="button"
                onClick={openAddParkingModal}
                className="rounded-2xl bg-white px-5 py-4 text-lg font-semibold text-black"
              >
                Ajouter un parking
              </button>
            </div>

            {visibleParkingLinks.length ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {visibleParkingLinks.map((parking) => (
                  <div
                    key={parking.id}
                    className="rounded-[28px] border border-white/10 bg-[#1E1E1E] p-5"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-2xl font-bold">{parking.name}</h2>
                        <p className="mt-1 text-sm text-zinc-500">
                          {parkingCounts.get(parking.name) || 0} véhicule
                          {(parkingCounts.get(parking.name) || 0) > 1 ? 's' : ''}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => openManageParking(parking)}
                        className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
                      >
                        Gérer
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-2xl bg-[#151515] px-4 py-4">
                        <p className="text-xs uppercase tracking-wide text-zinc-500">Adresse entrée</p>
                        <p className="mt-2 text-zinc-200">{parking.entry_address || '—'}</p>
                      </div>

                      <div className="rounded-2xl bg-[#151515] px-4 py-4">
                        <p className="text-xs uppercase tracking-wide text-zinc-500">Adresse sortie</p>
                        <p className="mt-2 text-zinc-200">{parking.exit_address || '—'}</p>
                      </div>

                      <div className="rounded-2xl bg-[#151515] px-4 py-4">
                        <p className="text-xs uppercase tracking-wide text-zinc-500">Lien du parking</p>
                        {parking.parking_url ? (
                          <a
                            href={parking.parking_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 block break-all text-[#6FAAF2] underline"
                          >
                            {parking.parking_url}
                          </a>
                        ) : (
                          <p className="mt-2 text-zinc-200">—</p>
                        )}
                      </div>

                      {parking.notes ? (
                        <div className="rounded-2xl bg-[#151515] px-4 py-4">
                          <p className="text-xs uppercase tracking-wide text-zinc-500">Notes</p>
                          <p className="mt-2 text-zinc-200">{parking.notes}</p>
                        </div>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => openParkingVehicles(parking.name)}
                      className="mt-4 w-full rounded-2xl border border-white/15 px-4 py-3 text-sm text-white hover:bg-white/5"
                    >
                      Voir les véhicules de ce parking
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[28px] border border-white/10 bg-[#1E1E1E] p-6 text-zinc-400">
                Aucun parking trouvé.
              </div>
            )}
          </>
        )}

        {pageMode === 'deleted' && (
          <div className="rounded-[28px] border border-white/10 bg-[#1E1E1E] p-6">
            <div className="mb-5">
              <h2 className="text-2xl font-bold">Récemment supprimés</h2>
              <p className="mt-1 text-zinc-400">Les véhicules restent récupérables pendant 30 jours.</p>
            </div>

            {archivedVehicles.length ? (
              <div className="space-y-4">
                {archivedVehicles.map((vehicle) => (
                  <div key={vehicle.id} className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-lg font-semibold text-white">{vehicle.license_plate}</div>
                        <div className="mt-1 text-sm text-zinc-400">
                          {vehicle.brand || '—'} {vehicle.model || ''}
                        </div>
                        <div className="mt-2 text-sm text-zinc-500">
                          Archivé le{' '}
                          {vehicle.archived_at ? new Date(vehicle.archived_at).toLocaleDateString('fr-FR') : '—'} •{' '}
                          {daysLeftFromArchive(vehicle.archived_at)} jour
                          {daysLeftFromArchive(vehicle.archived_at) > 1 ? 's' : ''} restants
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRestoreVehicle(vehicle)}
                        disabled={restoringId === vehicle.id}
                        className="rounded-2xl bg-white px-5 py-3 font-semibold text-black disabled:opacity-50"
                      >
                        {restoringId === vehicle.id ? 'Restauration...' : 'Restaurer'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-4 text-zinc-400">
                Aucun véhicule dans Récemment supprimés.
              </div>
            )}
          </div>
        )}

        {(pageMode === 'assurances' || pageMode === 'claims') && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="rounded-[28px] border border-white/10 bg-[#1E1E1E] p-6">
              <h2 className="text-2xl font-bold">{pageMode === 'assurances' ? 'Assurances' : 'Sinistres'}</h2>
              <p className="mt-3 text-zinc-400">
                Cette section est prête à accueillir les prochains modules. Tu peux y connecter ensuite :
              </p>
              <ul className="mt-4 space-y-2 text-zinc-300">
                <li>• dossiers Getaround / AXA / BCA</li>
                <li>• montants et statuts</li>
                <li>• photos / pièces jointes</li>
                <li>• accès rapide aux véhicules liés</li>
                <li>• suivi opérationnel</li>
              </ul>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[#1E1E1E] p-6">
              <h2 className="text-2xl font-bold">Amélioration utile</h2>
              <p className="mt-3 text-zinc-400">
                Pour la suite, le plus intéressant sera d’ajouter des coordonnées GPS sur les parkings pour afficher
                une carte et accélérer les trajets / programmations.
              </p>
              <div className="mt-5 rounded-2xl bg-[#151515] p-4 text-sm text-zinc-300">
                Colonnes futures conseillées : <span className="font-semibold">latitude</span> et{' '}
                <span className="font-semibold">longitude</span> dans la table parkings.
              </div>
            </div>
          </div>
        )}
      </div>

      {sidebarOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <div className="fixed left-0 top-0 z-50 h-full w-[320px] max-w-[85vw] border-r border-white/10 bg-[#121212] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={resetToMain}
                className="rounded-2xl border border-white/10 bg-[#1E1E1E] px-4 py-3 text-left font-semibold hover:bg-white/5"
              >
                Menu principal
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
                onClick={openAddVehicleModal}
                className="w-full rounded-2xl border border-white/10 bg-white px-4 py-4 text-left text-lg font-semibold text-black"
              >
                Ajouter un véhicule
              </button>

              <button
                type="button"
                onClick={goToParkingLinks}
                className="w-full rounded-2xl border border-white/10 bg-[#1E1E1E] px-4 py-4 text-left text-lg font-semibold hover:bg-white/5"
              >
                Liens parkings
              </button>

              <button
                type="button"
                onClick={goToDeleted}
                className="w-full rounded-2xl border border-white/10 bg-[#1E1E1E] px-4 py-4 text-left text-lg font-semibold hover:bg-white/5"
              >
                Récemment supprimés
              </button>

              <button
                type="button"
                onClick={goToAssurances}
                className="w-full rounded-2xl border border-white/10 bg-[#1E1E1E] px-4 py-4 text-left text-lg font-semibold hover:bg-white/5"
              >
                Assurances
              </button>

              <button
                type="button"
                onClick={goToClaims}
                className="w-full rounded-2xl border border-white/10 bg-[#1E1E1E] px-4 py-4 text-left text-lg font-semibold hover:bg-white/5"
              >
                Sinistres
              </button>
            </div>
          </div>
        </>
      )}

      {addVehicleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-[#1E1E1E] p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Ajouter un véhicule</h2>
              <button
                type="button"
                onClick={() => {
                  setAddVehicleOpen(false)
                  setVehicleForm(emptyVehicleForm)
                }}
                className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300"
              >
                Fermer
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <input
                value={vehicleForm.license_plate}
                onChange={(e) => updateVehicleForm('license_plate', e.target.value)}
                placeholder="Immatriculation"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
              <input
                value={vehicleForm.brand}
                onChange={(e) => updateVehicleForm('brand', e.target.value)}
                placeholder="Marque"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
              <input
                value={vehicleForm.model}
                onChange={(e) => updateVehicleForm('model', e.target.value)}
                placeholder="Modèle"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
              <input
                value={vehicleForm.mileage}
                onChange={(e) => updateVehicleForm('mileage', e.target.value)}
                placeholder="Kilométrage"
                type="number"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
              <input
                value={vehicleForm.next_service_km}
                onChange={(e) => updateVehicleForm('next_service_km', e.target.value)}
                placeholder="Prochain entretien"
                type="number"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
              <input
                value={vehicleForm.parking_location}
                onChange={(e) => updateVehicleForm('parking_location', e.target.value)}
                placeholder="Emplacement parking"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />

              <select
                value={vehicleForm.status}
                onChange={(e) => updateVehicleForm('status', e.target.value)}
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              >
                <option value="Disponible">Disponible</option>
                <option value="En contrat LLD">En contrat LLD</option>
                <option value="Carrosserie en cours">Carrosserie en cours</option>
                <option value="Entretien">Entretien</option>
                <option value="Indisponible">Indisponible</option>
              </select>

              <select
                value={vehicleForm.bodywork_status}
                onChange={(e) => updateVehicleForm('bodywork_status', e.target.value)}
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              >
                <option value="ok">OK</option>
                <option value="a_verifier">À vérifier</option>
                <option value="en_cours">En réparation</option>
                <option value="urgent">Urgent</option>
              </select>

              <textarea
                value={vehicleForm.notes}
                onChange={(e) => updateVehicleForm('notes', e.target.value)}
                placeholder="Notes"
                className="min-h-[120px] rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none md:col-span-2"
              />
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleAddVehicle}
                disabled={savingVehicle}
                className="rounded-2xl bg-white px-5 py-3 font-semibold text-black disabled:opacity-50"
              >
                {savingVehicle ? 'Ajout...' : 'Enregistrer le véhicule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {manageVehicleOpen && selectedVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-[#1E1E1E] p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Gérer {selectedVehicle.license_plate}</h2>
              <button
                type="button"
                onClick={() => setManageVehicleOpen(false)}
                className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300"
              >
                Fermer
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <input
                value={editVehicleForm.license_plate}
                onChange={(e) => updateEditVehicleForm('license_plate', e.target.value)}
                placeholder="Immatriculation"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
              <input
                value={editVehicleForm.brand}
                onChange={(e) => updateEditVehicleForm('brand', e.target.value)}
                placeholder="Marque"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
              <input
                value={editVehicleForm.model}
                onChange={(e) => updateEditVehicleForm('model', e.target.value)}
                placeholder="Modèle"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
              <input
                value={editVehicleForm.mileage}
                onChange={(e) => updateEditVehicleForm('mileage', e.target.value)}
                placeholder="Kilométrage"
                type="number"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
              <input
                value={editVehicleForm.next_service_km}
                onChange={(e) => updateEditVehicleForm('next_service_km', e.target.value)}
                placeholder="Prochain entretien"
                type="number"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
              <input
                value={editVehicleForm.parking_location}
                onChange={(e) => updateEditVehicleForm('parking_location', e.target.value)}
                placeholder="Emplacement parking"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />

              <select
                value={editVehicleForm.status}
                onChange={(e) => updateEditVehicleForm('status', e.target.value)}
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              >
                <option value="Disponible">Disponible</option>
                <option value="En contrat LLD">En contrat LLD</option>
                <option value="Carrosserie en cours">Carrosserie en cours</option>
                <option value="Entretien">Entretien</option>
                <option value="Indisponible">Indisponible</option>
              </select>

              <select
                value={editVehicleForm.bodywork_status}
                onChange={(e) => updateEditVehicleForm('bodywork_status', e.target.value)}
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              >
                <option value="ok">OK</option>
                <option value="a_verifier">À vérifier</option>
                <option value="en_cours">En réparation</option>
                <option value="urgent">Urgent</option>
              </select>

              <textarea
                value={editVehicleForm.notes}
                onChange={(e) => updateEditVehicleForm('notes', e.target.value)}
                placeholder="Notes"
                className="min-h-[120px] rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none md:col-span-2"
              />
            </div>

            <div className="mt-6 flex flex-wrap justify-between gap-3">
              <button
                type="button"
                onClick={handleArchiveVehicle}
                disabled={savingEditVehicle}
                className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 font-semibold text-red-300 disabled:opacity-50"
              >
                Supprimer (30 jours)
              </button>

              <button
                type="button"
                onClick={handleSaveVehicle}
                disabled={savingEditVehicle}
                className="rounded-2xl bg-white px-5 py-3 font-semibold text-black disabled:opacity-50"
              >
                {savingEditVehicle ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </button>
            </div>
          </div>
        </div>
      )}

      {addParkingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-[#1E1E1E] p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Ajouter un parking</h2>
              <button
                type="button"
                onClick={() => {
                  setAddParkingOpen(false)
                  setParkingForm(emptyParkingForm)
                }}
                className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300"
              >
                Fermer
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <input
                value={parkingForm.name}
                onChange={(e) => updateParkingForm('name', e.target.value)}
                placeholder="Nom du parking"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
              <input
                value={parkingForm.entry_address}
                onChange={(e) => updateParkingForm('entry_address', e.target.value)}
                placeholder="Adresse d'entrée"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
              <input
                value={parkingForm.exit_address}
                onChange={(e) => updateParkingForm('exit_address', e.target.value)}
                placeholder="Adresse de sortie"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
              <input
                value={parkingForm.parking_url}
                onChange={(e) => updateParkingForm('parking_url', e.target.value)}
                placeholder="Lien du parking"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
              <textarea
                value={parkingForm.notes}
                onChange={(e) => updateParkingForm('notes', e.target.value)}
                placeholder="Notes"
                className="min-h-[120px] rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleAddParking}
                disabled={savingParking}
                className="rounded-2xl bg-white px-5 py-3 font-semibold text-black disabled:opacity-50"
              >
                {savingParking ? 'Enregistrement...' : 'Ajouter le parking'}
              </button>
            </div>
          </div>
        </div>
      )}

      {manageParkingOpen && selectedParkingLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-[#1E1E1E] p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Gérer {selectedParkingLink.name}</h2>
              <button
                type="button"
                onClick={() => setManageParkingOpen(false)}
                className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300"
              >
                Fermer
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <input
                value={parkingForm.name}
                onChange={(e) => updateParkingForm('name', e.target.value)}
                placeholder="Nom du parking"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
              <input
                value={parkingForm.entry_address}
                onChange={(e) => updateParkingForm('entry_address', e.target.value)}
                placeholder="Adresse d'entrée"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
              <input
                value={parkingForm.exit_address}
                onChange={(e) => updateParkingForm('exit_address', e.target.value)}
                placeholder="Adresse de sortie"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
              <input
                value={parkingForm.parking_url}
                onChange={(e) => updateParkingForm('parking_url', e.target.value)}
                placeholder="Lien du parking"
                className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
              <textarea
                value={parkingForm.notes}
                onChange={(e) => updateParkingForm('notes', e.target.value)}
                placeholder="Notes"
                className="min-h-[120px] rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none"
              />
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleSaveParking}
                disabled={savingParking}
                className="rounded-2xl bg-white px-5 py-3 font-semibold text-black disabled:opacity-50"
              >
                {savingParking ? 'Enregistrement...' : 'Enregistrer le parking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}