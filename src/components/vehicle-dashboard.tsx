'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
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

type ParkingLink = {
  id: number | null
  parking_name: string
  entry_address: string | null
  exit_address: string | null
  parking_url: string | null
}

type ParkingForm = {
  parking_name: string
  entry_address: string
  exit_address: string
  parking_url: string
}

type ViewMode = 'cards' | 'list' | 'parking'
type FilterKey = 'dispo' | 'contrat' | 'carro' | 'entretien'

type StatCard = {
  key: FilterKey
  label: string
  total: number
  textColor: string
  borderColor: string
}

type FilterTab = {
  key: FilterKey
  label: string
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

const emptyParkingForm: ParkingForm = {
  parking_name: '',
  entry_address: '',
  exit_address: '',
  parking_url: '',
}

const inputCls =
  'rounded-2xl border border-white/10 bg-[#151515] px-4 py-3 outline-none'
const modalBtnCls =
  'rounded-2xl bg-white px-5 py-3 font-semibold text-black disabled:opacity-50'
const ghostBtnCls =
  'rounded-2xl border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5'

function formatKm(value: number | null) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('fr-FR').format(value)
}

function normalizeParkingName(value: string | null | undefined) {
  return (value || '').trim().toLowerCase()
}

function cleanParkingName(value: string | null | undefined) {
  return (value || '').trim()
}

function isAvailable(vehicle: Vehicle) {
  return (vehicle.status || '').toLowerCase().includes('disponible')
}

function isContract(vehicle: Vehicle) {
  return (vehicle.status || '').toLowerCase().includes('contrat')
}

function isBodywork(vehicle: Vehicle) {
  return (vehicle.status || '').toLowerCase().includes('carrosserie')
}

function isMaintenance(vehicle: Vehicle) {
  const mileage = vehicle.mileage || 0
  const nextService = vehicle.next_service_km || 0
  return !!nextService && mileage >= nextService - 3000
}

function getStatusLabel(status: string | null) {
  const s = (status || '').toLowerCase()
  if (s.includes('contrat')) return 'JR'
  return status || '—'
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
  return Math.max(0, 30 - Math.floor(diff / 86400000))
}

function countAvailable(vehicles: Vehicle[]) {
  return vehicles.filter((v) => !(v.is_archived ?? false) && isAvailable(v)).length
}

function countContract(vehicles: Vehicle[]) {
  return vehicles.filter((v) => !(v.is_archived ?? false) && isContract(v)).length
}

function countBodywork(vehicles: Vehicle[]) {
  return vehicles.filter((v) => !(v.is_archived ?? false) && isBodywork(v)).length
}

function countMaintenance(vehicles: Vehicle[]) {
  return vehicles.filter((v) => !(v.is_archived ?? false) && isMaintenance(v)).length
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

function toParkingForm(parking: ParkingLink): ParkingForm {
  return {
    parking_name: parking.parking_name || '',
    entry_address: parking.entry_address || '',
    exit_address: parking.exit_address || '',
    parking_url: parking.parking_url || '',
  }
}

export default function VehicleDashboard({ vehicles }: Props) {
  const router = useRouter()

  const [vehicleList, setVehicleList] = useState<Vehicle[]>(vehicles)
  const [parkingLinks, setParkingLinks] = useState<ParkingLink[]>([])

  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<FilterKey[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('cards')

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showDeletedPanel, setShowDeletedPanel] = useState(false)
  const [showParkingLinksPanel, setShowParkingLinksPanel] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [parkingOpen, setParkingOpen] = useState(false)

  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [selectedParking, setSelectedParking] = useState<string | null>(null)
  const [selectedParkingLink, setSelectedParkingLink] = useState<ParkingLink | null>(null)

  const [addForm, setAddForm] = useState<VehicleForm>(emptyForm)
  const [editForm, setEditForm] = useState<VehicleForm>(emptyForm)
  const [parkingForm, setParkingForm] = useState<ParkingForm>(emptyParkingForm)

  const [savingAdd, setSavingAdd] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [savingParking, setSavingParking] = useState(false)
  const [restoringId, setRestoringId] = useState<number | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  useEffect(() => {
    async function loadParkingLinks() {
      const { data, error } = await supabase
        .from('parking_links')
        .select('*')
        .order('parking_name', { ascending: true })

      if (error) {
        setActionMessage(`Erreur parking_links : ${error.message}`)
        return
      }

      setParkingLinks((data || []) as ParkingLink[])
    }

    loadParkingLinks()
  }, [])

  const activeVehicles = useMemo(
    () => vehicleList.filter((v) => !(v.is_archived ?? false)),
    [vehicleList]
  )

  const archivedVehicles = useMemo(
    () =>
      vehicleList
        .filter((v) => v.is_archived ?? false)
        .sort(
          (a, b) =>
            (b.archived_at ? new Date(b.archived_at).getTime() : 0) -
            (a.archived_at ? new Date(a.archived_at).getTime() : 0)
        ),
    [vehicleList]
  )

  const filteredVehicles = useMemo(() => {
    const q = search.trim().toLowerCase()

    return activeVehicles.filter((vehicle) => {
      const searchable = [
        vehicle.license_plate,
        vehicle.parking_location,
        vehicle.brand,
        vehicle.model,
        vehicle.status,
        vehicle.bodywork_status,
        vehicle.notes,
      ]
        .join(' ')
        .toLowerCase()

      const matchesSearch = !q || searchable.includes(q)

      const matchesFilters =
        activeFilters.length === 0 ||
        activeFilters.every((filterKey) => {
          if (filterKey === 'dispo') return isAvailable(vehicle)
          if (filterKey === 'contrat') return isContract(vehicle)
          if (filterKey === 'carro') return isBodywork(vehicle)
          if (filterKey === 'entretien') return isMaintenance(vehicle)
          return true
        })

      return matchesSearch && matchesFilters
    })
  }, [activeVehicles, search, activeFilters])

  const parkingGroups = useMemo(() => {
    const groups = new Map<string, Vehicle[]>()

    for (const vehicle of filteredVehicles) {
      const parking = cleanParkingName(vehicle.parking_location) || 'Sans parking'
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
  }, [filteredVehicles])

  const selectedParkingVehicles = useMemo(() => {
    if (!selectedParking) return []
    return parkingGroups.find((group) => group.parking === selectedParking)?.vehicles || []
  }, [parkingGroups, selectedParking])

  const parkingLinkCards = useMemo(() => {
    const map = new Map<string, ParkingLink>()

    for (const vehicle of activeVehicles) {
      const name = cleanParkingName(vehicle.parking_location)
      if (!name) continue
      const key = normalizeParkingName(name)
      if (!map.has(key)) {
        map.set(key, {
          id: null,
          parking_name: name,
          entry_address: null,
          exit_address: null,
          parking_url: null,
        })
      }
    }

    for (const row of parkingLinks) {
      const name = cleanParkingName(row.parking_name)
      if (!name) continue
      map.set(normalizeParkingName(name), {
        id: row.id,
        parking_name: name,
        entry_address: row.entry_address || null,
        exit_address: row.exit_address || null,
        parking_url: row.parking_url || null,
      })
    }

    const q = search.trim().toLowerCase()

    return Array.from(map.values())
      .filter((item) => {
        const searchable = [
          item.parking_name,
          item.entry_address || '',
          item.exit_address || '',
          item.parking_url || '',
        ]
          .join(' ')
          .toLowerCase()

        return !q || searchable.includes(q)
      })
      .sort((a, b) => a.parking_name.localeCompare(b.parking_name))
  }, [activeVehicles, parkingLinks, search])

  const statCards: StatCard[] = [
    {
      key: 'dispo',
      label: 'Disponibles',
      total: countAvailable(vehicleList),
      textColor: 'text-emerald-400',
      borderColor: 'border-emerald-500/60',
    },
    {
      key: 'contrat',
      label: 'JR',
      total: countContract(vehicleList),
      textColor: 'text-[#6FAAF2]',
      borderColor: 'border-[#6FAAF2]/60',
    },
    {
      key: 'carro',
      label: 'Carrosserie',
      total: countBodywork(vehicleList),
      textColor: 'text-[#F2AE2E]',
      borderColor: 'border-[#F2AE2E]/60',
    },
    {
      key: 'entretien',
      label: 'Entretien dû',
      total: countMaintenance(vehicleList),
      textColor: 'text-[#F55252]',
      borderColor: 'border-[#F55252]/60',
    },
  ]

  const filterTabs: FilterTab[] = [
    { key: 'dispo', label: 'Disponibles' },
    { key: 'contrat', label: 'JR' },
    { key: 'carro', label: 'Carrosserie' },
    { key: 'entretien', label: 'Entretien' },
  ]

  function toggleFilter(key: FilterKey) {
    setSelectedParking(null)
    setActiveFilters((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    )
  }

  function clearFilters() {
    setSelectedParking(null)
    setActiveFilters([])
  }

  const updateAddForm = (key: keyof VehicleForm, value: string) =>
    setAddForm((prev) => ({ ...prev, [key]: value }))

  const updateEditForm = (key: keyof VehicleForm, value: string) =>
    setEditForm((prev) => ({ ...prev, [key]: value }))

  const updateParkingForm = (key: keyof ParkingForm, value: string) =>
    setParkingForm((prev) => ({ ...prev, [key]: value }))

  const openManage = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle)
    setEditForm(toForm(vehicle))
    setActionMessage(null)
    setManageOpen(true)
  }

  const openAddModal = () => {
    setSidebarOpen(false)
    setShowDeletedPanel(false)
    setShowParkingLinksPanel(false)
    setActionMessage(null)
    setAddForm(emptyForm)
    setAddOpen(true)
  }

  const openParkingModal = (parking?: ParkingLink) => {
    setSidebarOpen(false)
    setActionMessage(null)
    setSelectedParkingLink(parking || null)
    setParkingForm(parking ? toParkingForm(parking) : emptyParkingForm)
    setParkingOpen(true)
  }

  const goActive = () => {
    setSidebarOpen(false)
    setShowDeletedPanel(false)
    setShowParkingLinksPanel(false)
    setSelectedParking(null)
    setActiveFilters([])
    setViewMode('cards')
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
      next_service_km: addForm.next_service_km ? Number(addForm.next_service_km) : null,
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
      next_service_km: editForm.next_service_km ? Number(editForm.next_service_km) : null,
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

  async function handleSaveParkingLink() {
    setActionMessage(null)

    const parkingName = parkingForm.parking_name.trim()
    if (!parkingName) {
      setActionMessage('Le nom du parking est obligatoire.')
      return
    }

    setSavingParking(true)

    const payload = {
      parking_name: parkingName,
      entry_address: parkingForm.entry_address.trim() || null,
      exit_address: parkingForm.exit_address.trim() || null,
      parking_url: parkingForm.parking_url.trim() || null,
    }

    const { data, error } = await supabase
      .from('parking_links')
      .upsert(payload, { onConflict: 'parking_name' })
      .select('*')
      .single()

    if (error) {
      setActionMessage(`Erreur parking : ${error.message}`)
      setSavingParking(false)
      return
    }

    if (data) {
      const row = data as ParkingLink
      setParkingLinks((prev) => {
        const key = normalizeParkingName(row.parking_name)
        const others = prev.filter(
          (item) => normalizeParkingName(item.parking_name) !== key
        )
        return [...others, row].sort((a, b) =>
          a.parking_name.localeCompare(b.parking_name)
        )
      })
      setActionMessage('Parking enregistré avec succès.')
    }

    setSavingParking(false)
    setParkingOpen(false)
    setSelectedParkingLink(null)
    setParkingForm(emptyParkingForm)
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

  const renderViewSwitch = () => (
    <div className="inline-flex w-fit rounded-2xl border border-white/15 bg-[#1E1E1E] p-1">
      <button
        type="button"
        onClick={() => {
          setSelectedParking(null)
          setViewMode('cards')
        }}
        className={`rounded-xl px-5 py-2 text-sm md:text-base ${
          viewMode === 'cards' ? 'bg-white text-black' : 'text-zinc-300'
        }`}
      >
        Vue cartes
      </button>
      <button
        type="button"
        onClick={() => {
          setSelectedParking(null)
          setViewMode('list')
        }}
        className={`rounded-xl px-5 py-2 text-sm md:text-base ${
          viewMode === 'list' ? 'bg-white text-black' : 'text-zinc-300'
        }`}
      >
        Vue liste
      </button>
      <button
        type="button"
        onClick={() => {
          setSelectedParking(null)
          setViewMode('parking')
        }}
        className={`rounded-xl px-5 py-2 text-sm md:text-base ${
          viewMode === 'parking' ? 'bg-white text-black' : 'text-zinc-300'
        }`}
      >
        Vue parkings
      </button>
    </div>
  )

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
            {getStatusLabel(vehicle.status)}
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
            <p className="text-lg text-zinc-400">Marque</p>
            <p className="text-4xl font-semibold leading-tight">
              {vehicle.brand} {vehicle.model}
            </p>
            <p className="mt-5 text-3xl font-medium text-zinc-200">
              {formatKm(vehicle.mileage)} km
            </p>
          </div>

          <div>
            <p className="text-lg text-zinc-400">Emplacement</p>
            <p className="text-4xl font-semibold leading-tight">
              {vehicle.parking_location || '—'}
            </p>
          </div>

          <div>
            <p className="text-lg text-zinc-400">Carrosserie</p>
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
  )

  const renderVehicleList = (items: Vehicle[]) => (
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
        {items.map((vehicle) => (
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
              <p className="text-zinc-200">{vehicle.parking_location || '—'}</p>
            </Link>

            <Link href={`/vehicles/${vehicle.id}`} className="block">
              <p className="text-xs text-zinc-500 md:hidden">Statut</p>
              <span
                className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-medium ${getStatusBadge(
                  vehicle.status
                )}`}
              >
                {getStatusLabel(vehicle.status)}
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

            <div>
              <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
                {showParkingLinksPanel ? 'Liens parkings' : 'Flotte de véhicules'}
              </h1>
            </div>
          </div>

          <div className="text-right text-lg text-zinc-300 md:text-2xl">
            {showDeletedPanel
              ? `${archivedVehicles.length} supprimé${archivedVehicles.length > 1 ? 's' : ''}`
              : showParkingLinksPanel
              ? `${parkingLinkCards.length} parking${parkingLinkCards.length > 1 ? 's' : ''}`
              : viewMode === 'parking'
              ? selectedParking
                ? `${selectedParkingVehicles.length} véhicule${selectedParkingVehicles.length > 1 ? 's' : ''}`
                : `${parkingGroups.length} parking${parkingGroups.length > 1 ? 's' : ''}`
              : `${filteredVehicles.length} véhicule${filteredVehicles.length > 1 ? 's' : ''}`}
          </div>
        </div>

        {!showDeletedPanel && !showParkingLinksPanel && (
          <>
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {statCards.map((card) => (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => toggleFilter(card.key)}
                  className={`rounded-3xl border bg-[#1E1E1E] p-6 text-left transition ${
                    activeFilters.includes(card.key) ? card.borderColor : 'border-transparent'
                  }`}
                >
                  <p className="text-lg text-zinc-300">{card.label}</p>
                  <p className={`mt-4 text-5xl font-semibold ${card.textColor}`}>
                    {card.total}
                  </p>
                </button>
              ))}
            </div>
          </>
        )}

        {!showDeletedPanel && (
          <div className="mb-6">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSelectedParking(null)
                setSearch(e.target.value)
              }}
              placeholder={
                showParkingLinksPanel
                  ? 'Rechercher par nom de parking, adresse entrée, adresse sortie ou lien'
                  : viewMode === 'parking'
                  ? 'Rechercher par parking, immatriculation, marque, statut ou note'
                  : 'Rechercher par immatriculation, marque, parking, statut ou note'
              }
              className="w-full rounded-2xl border border-white/10 bg-[#1E1E1E] px-5 py-4 text-lg text-white outline-none placeholder:text-zinc-500"
            />
          </div>
        )}

        {!showDeletedPanel && !showParkingLinksPanel && (
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={clearFilters}
                className={`rounded-2xl border px-6 py-3 text-lg ${
                  activeFilters.length === 0
                    ? 'border-white bg-white text-black'
                    : 'border-white/20 text-white'
                }`}
              >
                Tous
              </button>

              {filterTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => toggleFilter(tab.key)}
                  className={`rounded-2xl border px-6 py-3 text-lg ${
                    activeFilters.includes(tab.key)
                      ? 'border-white bg-white text-black'
                      : 'border-white/20 text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {renderViewSwitch()}
          </div>
        )}

        {actionMessage ? (
          <div className="mb-6 rounded-2xl border border-white/10 bg-[#1E1E1E] px-4 py-3 text-sm text-zinc-300">
            {actionMessage}
          </div>
        ) : null}

        {showParkingLinksPanel ? (
          <div className="space-y-5">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => openParkingModal()}
                className={modalBtnCls}
              >
                Ajouter un parking
              </button>
            </div>

            {parkingLinkCards.length === 0 ? (
              <div className="rounded-[28px] border border-white/10 bg-[#1E1E1E] p-6 text-zinc-400">
                Aucun parking trouvé.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {parkingLinkCards.map((parking) => (
                  <div
                    key={normalizeParkingName(parking.parking_name)}
                    className="rounded-[24px] border border-white/10 bg-[#1E1E1E] p-5"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-2xl font-bold text-white">
                          {parking.parking_name}
                        </h2>
                      </div>

                      <button
                        type="button"
                        onClick={() => openParkingModal(parking)}
                        className="rounded-xl border border-white/15 px-3 py-2 text-sm text-white hover:bg-white/5"
                      >
                        Gérer
                      </button>
                    </div>

                    <div className="space-y-3 text-sm text-zinc-300">
                      <div className="rounded-2xl bg-[#151515] px-4 py-3">
                        <p className="mb-1 text-xs uppercase tracking-[0.08em] text-zinc-500">
                          Adresse entrée
                        </p>
                        <p>{parking.entry_address || '—'}</p>
                      </div>

                      <div className="rounded-2xl bg-[#151515] px-4 py-3">
                        <p className="mb-1 text-xs uppercase tracking-[0.08em] text-zinc-500">
                          Adresse sortie
                        </p>
                        <p>{parking.exit_address || '—'}</p>
                      </div>

                      <div className="rounded-2xl bg-[#151515] px-4 py-3">
                        <p className="mb-1 text-xs uppercase tracking-[0.08em] text-zinc-500">
                          Lien du parking
                        </p>
                        {parking.parking_url ? (
                          <a
                            href={parking.parking_url}
                            target="_blank"
                            rel="noreferrer"
                            className="break-all text-[#6FAAF2] underline underline-offset-4"
                          >
                            {parking.parking_url}
                          </a>
                        ) : (
                          <p>—</p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setShowParkingLinksPanel(false)
                          setViewMode('parking')
                          setSelectedParking(parking.parking_name)
                        }}
                        className="w-full rounded-2xl border border-white/15 px-4 py-3 text-sm font-medium text-white hover:bg-white/5"
                      >
                        Voir les véhicules de ce parking
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : showDeletedPanel ? (
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
                  clearFilters()
                }}
                className={ghostBtnCls}
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
                            ? new Date(vehicle.archived_at).toLocaleDateString('fr-FR')
                            : '—'}{' '}
                          • {daysLeftFromArchive(vehicle.archived_at)} jour
                          {daysLeftFromArchive(vehicle.archived_at) > 1 ? 's' : ''} restants
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRestoreVehicle(vehicle)}
                        disabled={restoringId === vehicle.id}
                        className={modalBtnCls}
                      >
                        {restoringId === vehicle.id ? 'Restauration...' : 'Restaurer'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : viewMode === 'parking' ? (
          selectedParking ? (
            <div className="space-y-5">
              <div className="rounded-[28px] border border-white/10 bg-[#1E1E1E] p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
                    className={ghostBtnCls}
                  >
                    Retour aux parkings
                  </button>
                </div>
              </div>

              {renderVehicleList(selectedParkingVehicles)}
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
                      <h2 className="text-2xl font-bold text-white">{group.parking}</h2>
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
                            {getStatusLabel(vehicle.status)}
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
          <div className="space-y-5">{filteredVehicles.map(renderVehicleCard)}</div>
        ) : (
          renderVehicleList(filteredVehicles)
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
                onClick={goActive}
                className="flex-1 rounded-2xl border border-white/10 bg-[#1E1E1E] px-4 py-4 text-left hover:bg-white/5"
              >
                <div className="text-sm font-medium text-zinc-400">Menu principal</div>
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
                onClick={goActive}
                className="w-full rounded-2xl border border-white/10 bg-[#1E1E1E] px-4 py-4 text-left text-lg font-semibold hover:bg-white/5"
              >
                Véhicules actifs
              </button>

              <button
                type="button"
                onClick={() => {
                  setSidebarOpen(false)
                  setShowDeletedPanel(false)
                  setShowParkingLinksPanel(true)
                  setSelectedParking(null)
                }}
                className="w-full rounded-2xl border border-white/10 bg-[#1E1E1E] px-4 py-4 text-left text-lg font-semibold hover:bg-white/5"
              >
                Liens parkings
              </button>

              <button
                type="button"
                onClick={() => openParkingModal()}
                className="w-full rounded-2xl border border-white/10 bg-[#1E1E1E] px-4 py-4 text-left text-lg font-semibold hover:bg-white/5"
              >
                Ajouter un parking
              </button>

              <button
                type="button"
                onClick={() => {
                  setSidebarOpen(false)
                  setShowDeletedPanel(true)
                  setShowParkingLinksPanel(false)
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
                onChange={(e) => updateAddForm('license_plate', e.target.value)}
                placeholder="Immatriculation"
                className={inputCls}
              />
              <input
                value={addForm.brand}
                onChange={(e) => updateAddForm('brand', e.target.value)}
                placeholder="Marque"
                className={inputCls}
              />
              <input
                value={addForm.model}
                onChange={(e) => updateAddForm('model', e.target.value)}
                placeholder="Modèle"
                className={inputCls}
              />
              <input
                value={addForm.mileage}
                onChange={(e) => updateAddForm('mileage', e.target.value)}
                placeholder="Kilométrage"
                type="number"
                className={inputCls}
              />
              <input
                value={addForm.next_service_km}
                onChange={(e) => updateAddForm('next_service_km', e.target.value)}
                placeholder="Prochain entretien"
                type="number"
                className={inputCls}
              />
              <input
                value={addForm.parking_location}
                onChange={(e) => updateAddForm('parking_location', e.target.value)}
                placeholder="Emplacement parking"
                className={inputCls}
              />

              <select
                value={addForm.status}
                onChange={(e) => updateAddForm('status', e.target.value)}
                className={inputCls}
              >
                <option value="Disponible">Disponible</option>
                <option value="En contrat LLD">En contrat LLD</option>
                <option value="Carrosserie en cours">Carrosserie en cours</option>
                <option value="Entretien">Entretien</option>
                <option value="Indisponible">Indisponible</option>
              </select>

              <select
                value={addForm.bodywork_status}
                onChange={(e) => updateAddForm('bodywork_status', e.target.value)}
                className={inputCls}
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
                className={`${inputCls} min-h-[120px] md:col-span-2`}
              />
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleAddVehicle}
                disabled={savingAdd}
                className={modalBtnCls}
              >
                {savingAdd ? 'Ajout...' : 'Enregistrer le véhicule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {parkingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-[#1E1E1E] p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                {selectedParkingLink ? `Gérer ${selectedParkingLink.parking_name}` : 'Ajouter un parking'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setParkingOpen(false)
                  setSelectedParkingLink(null)
                  setParkingForm(emptyParkingForm)
                }}
                className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300"
              >
                Fermer
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <input
                value={parkingForm.parking_name}
                onChange={(e) => updateParkingForm('parking_name', e.target.value)}
                placeholder="Nom du parking"
                className={inputCls}
              />
              <input
                value={parkingForm.entry_address}
                onChange={(e) => updateParkingForm('entry_address', e.target.value)}
                placeholder="Adresse entrée"
                className={inputCls}
              />
              <input
                value={parkingForm.exit_address}
                onChange={(e) => updateParkingForm('exit_address', e.target.value)}
                placeholder="Adresse sortie"
                className={inputCls}
              />
              <input
                value={parkingForm.parking_url}
                onChange={(e) => updateParkingForm('parking_url', e.target.value)}
                placeholder="Lien du parking"
                className={inputCls}
              />
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleSaveParkingLink}
                disabled={savingParking}
                className={modalBtnCls}
              >
                {savingParking ? 'Enregistrement...' : 'Enregistrer le parking'}
              </button>
            </div>
          </div>
        </div>
      )}

      {manageOpen && selectedVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-[#1E1E1E] p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Gérer {selectedVehicle.license_plate}</h2>
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
                onChange={(e) => updateEditForm('license_plate', e.target.value)}
                placeholder="Immatriculation"
                className={inputCls}
              />
              <input
                value={editForm.brand}
                onChange={(e) => updateEditForm('brand', e.target.value)}
                placeholder="Marque"
                className={inputCls}
              />
              <input
                value={editForm.model}
                onChange={(e) => updateEditForm('model', e.target.value)}
                placeholder="Modèle"
                className={inputCls}
              />
              <input
                value={editForm.mileage}
                onChange={(e) => updateEditForm('mileage', e.target.value)}
                placeholder="Kilométrage"
                type="number"
                className={inputCls}
              />
              <input
                value={editForm.next_service_km}
                onChange={(e) => updateEditForm('next_service_km', e.target.value)}
                placeholder="Prochain entretien"
                type="number"
                className={inputCls}
              />
              <input
                value={editForm.parking_location}
                onChange={(e) => updateEditForm('parking_location', e.target.value)}
                placeholder="Emplacement parking"
                className={inputCls}
              />

              <select
                value={editForm.status}
                onChange={(e) => updateEditForm('status', e.target.value)}
                className={inputCls}
              >
                <option value="Disponible">Disponible</option>
                <option value="En contrat LLD">En contrat LLD</option>
                <option value="Carrosserie en cours">Carrosserie en cours</option>
                <option value="Entretien">Entretien</option>
                <option value="Indisponible">Indisponible</option>
              </select>

              <select
                value={editForm.bodywork_status}
                onChange={(e) => updateEditForm('bodywork_status', e.target.value)}
                className={inputCls}
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
                className={`${inputCls} min-h-[120px] md:col-span-2`}
              />
            </div>

            <div className="mt-6 flex flex-wrap justify-between gap-3">
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
                className={modalBtnCls}
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