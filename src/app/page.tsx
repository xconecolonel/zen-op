import { supabase } from '@/lib/supabase'
import VehicleDashboard from '@/components/vehicle-dashboard'

export const dynamic = 'force-dynamic'

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

export default async function Home() {
  const [{ data: vehiclesData, error: vehiclesError }, { data: parkingData, error: parkingError }] =
    await Promise.all([
      supabase.from('vehicles').select('*').order('id', { ascending: true }),
      supabase.from('parkings').select('*').order('name', { ascending: true }),
    ])

  if (vehiclesError || parkingError) {
    return (
      <main className="min-h-screen bg-[#111111] p-6 text-white">
        <h1 className="mb-6 text-3xl font-bold">Zen OP</h1>
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
          {vehiclesError ? <div>Erreur véhicules : {vehiclesError.message}</div> : null}
          {parkingError ? <div>Erreur parkings : {parkingError.message}</div> : null}
        </div>
      </main>
    )
  }

  return (
    <VehicleDashboard
      vehicles={(vehiclesData || []) as Vehicle[]}
      parkingLinks={(parkingData || []) as ParkingLink[]}
    />
  )
}