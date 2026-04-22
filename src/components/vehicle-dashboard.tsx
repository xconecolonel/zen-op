'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

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
}

type Props = {
  vehicles: Vehicle[]
}

function formatKm(value: number | null) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('fr-FR').format(value)
}

function getStatusBadge(status: string | null) {
  const s = (status || '').toLowerCase()

  if (s.includes('disponible')) {
    return 'bg-[#E8F1D9] text-[#3D5A1D]'
  }
  if (s.includes('contrat')) {
    return 'bg-[#DCE9F9] text-[#245B9B]'
  }
  if (s.includes('carrosserie')) {
    return 'bg-[#F2E6D3] text-[#8B5A1A]'
  }
  return 'bg-zinc-700 text-zinc-100'
}

function getBodyworkLabel(bodyworkStatus: string | null) {
  const v = (bodyworkStatus || '').toLowerCase()

  if (v === 'ok') return 'OK'
  if (v === 'a_verifier') return 'À vérifier'
  if (v === 'en_cours') return 'En réparation'
  return bodyworkStatus || '—'
}

function getBodyworkColor(bodyworkStatus: string | null) {
  const v = (bodyworkStatus || '').toLowerCase()

  if (v === 'ok') return 'text-emerald-400'
  if (v === 'a_verifier') return 'text-amber-400'
  if (v === 'en_cours') return 'text-red-400'
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
  const pct = Math.min((mileage / nextService) * 100, 100)
  return Math.max(pct, 10)
}

function countAvailable(vehicles: Vehicle[]) {
  return vehicles.filter((v) =>
    (v.status || '').toLowerCase().includes('disponible')
  ).length
}

function countContract(vehicles: Vehicle[]) {
  return vehicles.filter((v) =>
    (v.status || '').toLowerCase().includes('contrat')
  ).length
}

function countBodywork(vehicles: Vehicle[]) {
  return vehicles.filter((v) =>
    (v.status || '').toLowerCase().includes('carrosserie')
  ).length
}

function countMaintenance(vehicles: Vehicle[]) {
  return vehicles.filter((v) => {
    const mileage = v.mileage || 0
    const nextService = v.next_service_km || 0
    if (!nextService) return false
    return mileage >= nextService - 3000
  }).length
}

export default function VehicleDashboard({ vehicles }: Props) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards')

  const filteredVehicles = useMemo(() => {
    const q = search.trim().toLowerCase()

    return vehicles.filter((vehicle) => {
      const plate = (vehicle.license_plate || '').toLowerCase()
      const parking = (vehicle.parking_location || '').toLowerCase()

      const matchesSearch = !q || plate.includes(q) || parking.includes(q)

      let matchesFilter = true

      if (filter === 'dispo') {
        matchesFilter = (vehicle.status || '').toLowerCase().includes('disponible')
      }

      if (filter === 'contrat') {
        matchesFilter = (vehicle.status || '').toLowerCase().includes('contrat')
      }

      if (filter === 'carro') {
        matchesFilter = (vehicle.status || '').toLowerCase().includes('carrosserie')
      }

      if (filter === 'entretien') {
        const mileage = vehicle.mileage || 0
        const nextService = vehicle.next_service_km || 0
        matchesFilter = nextService > 0 && mileage >= nextService - 3000
      }

      return matchesSearch && matchesFilter
    })
  }, [vehicles, search, filter])

  return (
    <main className="min-h-screen bg-[#151515] text-white px-4 py-6 md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
              Flotte de véhicules
            </h1>
          </div>
          <div className="text-right text-zinc-300 text-lg md:text-2xl">
            {filteredVehicles.length} véhicule{filteredVehicles.length > 1 ? 's' : ''}
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            onClick={() => setFilter(filter === 'dispo' ? 'all' : 'dispo')}
            className={`rounded-3xl bg-[#1E1E1E] p-6 text-left transition border ${
              filter === 'dispo' ? 'border-emerald-500/60' : 'border-transparent'
            }`}
          >
            <p className="text-zinc-300 text-lg">Disponibles</p>
            <p className="mt-4 text-5xl font-semibold text-emerald-400">
              {countAvailable(vehicles)}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setFilter(filter === 'contrat' ? 'all' : 'contrat')}
            className={`rounded-3xl bg-[#1E1E1E] p-6 text-left transition border ${
              filter === 'contrat' ? 'border-[#6FAAF2]/60' : 'border-transparent'
            }`}
          >
            <p className="text-zinc-300 text-lg">En contrat LLD</p>
            <p className="mt-4 text-5xl font-semibold text-[#6FAAF2]">
              {countContract(vehicles)}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setFilter(filter === 'carro' ? 'all' : 'carro')}
            className={`rounded-3xl bg-[#1E1E1E] p-6 text-left transition border ${
              filter === 'carro' ? 'border-[#F2AE2E]/60' : 'border-transparent'
            }`}
          >
            <p className="text-zinc-300 text-lg">Carrosserie</p>
            <p className="mt-4 text-5xl font-semibold text-[#F2AE2E]">
              {countBodywork(vehicles)}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setFilter(filter === 'entretien' ? 'all' : 'entretien')}
            className={`rounded-3xl bg-[#1E1E1E] p-6 text-left transition border ${
              filter === 'entretien' ? 'border-[#F55252]/60' : 'border-transparent'
            }`}
          >
            <p className="text-zinc-300 text-lg">Entretien dû</p>
            <p className="mt-4 text-5xl font-semibold text-[#F55252]">
              {countMaintenance(vehicles)}
            </p>
          </button>
        </div>

        <div className="mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par immatriculation ou parking"
            className="w-full rounded-2xl border border-white/10 bg-[#1E1E1E] px-5 py-4 text-lg text-white outline-none placeholder:text-zinc-500"
          />
        </div>

        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setFilter('all')}
              className={`rounded-2xl border px-6 py-3 text-lg ${
                filter === 'all'
                  ? 'bg-white text-black border-white'
                  : 'border-white/20 text-white'
              }`}
            >
              Tous
            </button>

            <button
              onClick={() => setFilter('dispo')}
              className={`rounded-2xl border px-6 py-3 text-lg ${
                filter === 'dispo'
                  ? 'bg-white text-black border-white'
                  : 'border-white/20 text-white'
              }`}
            >
              Disponibles
            </button>

            <button
              onClick={() => setFilter('contrat')}
              className={`rounded-2xl border px-6 py-3 text-lg ${
                filter === 'contrat'
                  ? 'bg-white text-black border-white'
                  : 'border-white/20 text-white'
              }`}
            >
              En contrat
            </button>

            <button
              onClick={() => setFilter('carro')}
              className={`rounded-2xl border px-6 py-3 text-lg ${
                filter === 'carro'
                  ? 'bg-white text-black border-white'
                  : 'border-white/20 text-white'
              }`}
            >
              Carrosserie
            </button>

            <button
              onClick={() => setFilter('entretien')}
              className={`rounded-2xl border px-6 py-3 text-lg ${
                filter === 'entretien'
                  ? 'bg-white text-black border-white'
                  : 'border-white/20 text-white'
              }`}
            >
              Entretien
            </button>
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
                viewMode === 'list'
                  ? 'bg-white text-black'
                  : 'text-zinc-300'
              }`}
            >
              Vue liste
            </button>
          </div>
        </div>

        {viewMode === 'cards' ? (
          <div className="space-y-5">
            {filteredVehicles.map((vehicle) => (
              <Link
                key={vehicle.id}
                href={`/vehicles/${vehicle.id}`}
                className="block rounded-[28px] bg-[#242424] px-6 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:bg-[#2b2b2b] cursor-pointer"
              >
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="inline-flex w-fit rounded-2xl bg-[#1B1B1B] px-4 py-2 text-2xl font-semibold tracking-wide">
                    {vehicle.license_plate}
                  </div>

                  <div
                    className={`inline-flex w-fit rounded-full px-5 py-2 text-xl font-semibold ${getStatusBadge(
                      vehicle.status
                    )}`}
                  >
                    {vehicle.status || '—'}
                  </div>
                </div>

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
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#1E1E1E]">
            <div className="hidden grid-cols-7 gap-4 border-b border-white/10 bg-[#181818] px-6 py-4 text-sm font-medium text-zinc-400 md:grid">
              <div>Immatriculation</div>
              <div>Véhicule</div>
              <div>Km</div>
              <div>Entretien</div>
              <div>Parking</div>
              <div>Statut</div>
              <div>Carrosserie</div>
            </div>

            <div className="divide-y divide-white/10">
              {filteredVehicles.map((vehicle) => (
                <Link
                  key={vehicle.id}
                  href={`/vehicles/${vehicle.id}`}
                  className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-7 md:items-center hover:bg-white/[0.03] transition cursor-pointer"
                >
                  <div>
                    <p className="text-xs text-zinc-500 md:hidden">Immatriculation</p>
                    <p className="font-semibold text-white">{vehicle.license_plate}</p>
                  </div>

                  <div>
                    <p className="text-xs text-zinc-500 md:hidden">Véhicule</p>
                    <p className="text-white">
                      {vehicle.brand} {vehicle.model}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-zinc-500 md:hidden">Km</p>
                    <p className="text-zinc-200">{formatKm(vehicle.mileage)} km</p>
                  </div>

                  <div>
                    <p className="text-xs text-zinc-500 md:hidden">Entretien</p>
                    <p className="text-zinc-200">{formatKm(vehicle.next_service_km)} km</p>
                  </div>

                  <div>
                    <p className="text-xs text-zinc-500 md:hidden">Parking</p>
                    <p className="text-zinc-200">{vehicle.parking_location || '—'}</p>
                  </div>

                  <div>
                    <p className="text-xs text-zinc-500 md:hidden">Statut</p>
                    <span
                      className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-medium ${getStatusBadge(
                        vehicle.status
                      )}`}
                    >
                      {vehicle.status || '—'}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs text-zinc-500 md:hidden">Carrosserie</p>
                    <p className={`font-medium ${getBodyworkColor(vehicle.bodywork_status)}`}>
                      {getBodyworkLabel(vehicle.bodywork_status)}
                    </p>
                  </div>

                  {vehicle.notes ? (
                    <div className="md:col-span-7">
                      <p className="text-sm text-zinc-400">{vehicle.notes}</p>
                    </div>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}